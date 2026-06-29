export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '购物车' })
  : { navigationBarTitleText: '购物车' }
