export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '商品详情' })
  : { navigationBarTitleText: '商品详情' }
