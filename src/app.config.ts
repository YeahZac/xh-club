export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/event-register/index',
    'pages/admin/index',
    'pages/business/index',
    'pages/discover/index',
    'pages/message/index',
    'pages/profile/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1B2A4A',
    navigationBarTitleText: '粤商汇',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#C9A96E',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: './assets/tabbar/house.png',
        selectedIconPath: './assets/tabbar/house-active.png',
      },
      {
        pagePath: 'pages/business/index',
        text: '商机',
        iconPath: './assets/tabbar/briefcase.png',
        selectedIconPath: './assets/tabbar/briefcase-active.png',
      },
      {
        pagePath: 'pages/discover/index',
        text: '发现',
        iconPath: './assets/tabbar/compass.png',
        selectedIconPath: './assets/tabbar/compass-active.png',
      },
      {
        pagePath: 'pages/message/index',
        text: '消息',
        iconPath: './assets/tabbar/message-square.png',
        selectedIconPath: './assets/tabbar/message-square-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: './assets/tabbar/user.png',
        selectedIconPath: './assets/tabbar/user-active.png',
      }
    ]
  }
})
