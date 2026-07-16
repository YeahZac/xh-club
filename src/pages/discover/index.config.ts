export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '发现', navigationStyle: 'custom' })
  : { navigationBarTitleText: '发现', navigationStyle: 'custom' }
