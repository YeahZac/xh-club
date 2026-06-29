export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '分类' })
  : { navigationBarTitleText: '分类' }
