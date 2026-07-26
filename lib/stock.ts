import { createClient } from '@/lib/supabase/client'

// Ajusta o estoque de acordo com a "receita" de um produto (product_stock_usage).
// qtyDelta positivo = foi vendido mais (consome estoque, subtrai).
// qtyDelta negativo = item foi removido/reduzido (devolve estoque, soma).
export async function adjustStockForProduct(productId: string, qtyDelta: number) {
  if (!qtyDelta) return
  const supabase = createClient()

  const { data: usageRows } = await supabase
    .from('product_stock_usage')
    .select('stock_item_id, qty_per_unit')
    .eq('product_id', productId)

  if (!usageRows || usageRows.length === 0) return

  for (const usage of usageRows) {
    const { data: stockItem } = await supabase
      .from('stock_items')
      .select('qty')
      .eq('id', usage.stock_item_id)
      .single()
    if (!stockItem) continue
    const newQty = Math.max(0, stockItem.qty - usage.qty_per_unit * qtyDelta)
    await supabase.from('stock_items').update({ qty: newQty }).eq('id', usage.stock_item_id)
  }
}
