export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '商机' })
  : { navigationBarTitleText: '商机' }
