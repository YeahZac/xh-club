export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '星河百谷', navigationStyle: 'custom' })
  : { navigationBarTitleText: '星河百谷', navigationStyle: 'custom' }
