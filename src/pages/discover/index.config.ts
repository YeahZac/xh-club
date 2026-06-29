export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '发现' })
  : { navigationBarTitleText: '发现' }
