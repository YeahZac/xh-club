export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '商机', navigationStyle: 'custom' })
  : { navigationBarTitleText: '商机', navigationStyle: 'custom' }
