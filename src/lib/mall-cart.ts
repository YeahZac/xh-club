import Taro from '@tarojs/taro'

export interface CartItem {
  product_id: string
  name: string
  image_url: string
  points_price: number
  quantity: number
  stock: number
}

const CART_KEY = 'mall_cart'

export function getCart(): CartItem[] {
  try {
    const raw = Taro.getStorageSync(CART_KEY)
    if (!raw) return []
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveCart(items: CartItem[]) {
  Taro.setStorageSync(CART_KEY, items)
}

export function getCartCount() {
  return getCart().reduce((sum, item) => sum + (item.quantity || 0), 0)
}

export function addToCart(item: Omit<CartItem, 'quantity'> & { quantity?: number }) {
  const cart = getCart()
  const qty = Math.max(1, Math.floor(Number(item.quantity) || 1))
  const idx = cart.findIndex((c) => String(c.product_id) === String(item.product_id))
  if (idx >= 0) {
    const nextQty = Math.min(cart[idx].stock || 999, cart[idx].quantity + qty)
    cart[idx] = { ...cart[idx], ...item, quantity: nextQty }
  } else {
    cart.push({
      product_id: String(item.product_id),
      name: item.name,
      image_url: item.image_url,
      points_price: Number(item.points_price) || 0,
      stock: Number(item.stock) || 0,
      quantity: qty,
    })
  }
  saveCart(cart)
  return cart
}

export function updateCartQuantity(productId: string, quantity: number) {
  const cart = getCart()
  const idx = cart.findIndex((c) => String(c.product_id) === String(productId))
  if (idx < 0) return cart
  if (quantity <= 0) {
    cart.splice(idx, 1)
  } else {
    cart[idx].quantity = Math.min(cart[idx].stock || 999, Math.floor(quantity))
  }
  saveCart(cart)
  return cart
}

export function removeFromCart(productId: string) {
  const cart = getCart().filter((c) => String(c.product_id) !== String(productId))
  saveCart(cart)
  return cart
}

export function clearCart() {
  saveCart([])
}

export function getCartTotalPoints(items?: CartItem[]) {
  return (items || getCart()).reduce(
    (sum, item) => sum + Number(item.points_price || 0) * Number(item.quantity || 0),
    0,
  )
}
