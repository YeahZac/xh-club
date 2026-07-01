import { useState, useCallback, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Search, Download, Trash, Users, Shield, Eye, EyeOff, LogOut, Building } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Network } from '@/network'

/* ── 管理员密码（简单方案，生产环境应使用数据库+加密） ── */
const ADMIN_PASSWORD = 'xinghe2025'

interface Registration {
  id: string
  name: string
  gender: string
  birthday: string
  age: number | null
  industry: string
  phone: string
  contact_method: string | null
  referrer: string | null
  created_at: string
}

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [records, setRecords] = useState<Registration[]>([])
  const [filtered, setFiltered] = useState<Registration[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Registration | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  /* ── 登录 ── */
  const handleLogin = useCallback(() => {
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true)
      Taro.showToast({ title: '登录成功', icon: 'success' })
    } else {
      Taro.showToast({ title: '密码错误', icon: 'none' })
    }
  }, [password])

  /* ── 获取报名列表 ── */
  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/event-registration',
        method: 'GET',
      })
      console.log('管理后台获取列表响应:', res.data)
      if (res.statusCode === 200 && res.data?.code === 200) {
        const list = (res.data.data || []) as Registration[]
        setRecords(list)
        setFiltered(list)
      } else {
        Taro.showToast({ title: '获取数据失败', icon: 'none' })
      }
    } catch (err) {
      console.error('获取列表异常:', err)
      Taro.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoggedIn) {
      fetchRecords()
    }
  }, [isLoggedIn, fetchRecords])

  /* ── 搜索 ── */
  const handleSearch = useCallback((kw: string) => {
    setKeyword(kw)
    if (!kw.trim()) {
      setFiltered(records)
      return
    }
    const lower = kw.toLowerCase()
    const result = records.filter(r =>
      r.name.toLowerCase().includes(lower) ||
      r.phone.includes(lower) ||
      r.industry.toLowerCase().includes(lower) ||
      (r.referrer && r.referrer.toLowerCase().includes(lower))
    )
    setFiltered(result)
  }, [records])

  /* ── 删除 ── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await Network.request({
        url: `/api/event-registration/${deleteTarget.id}`,
        method: 'DELETE',
      })
      console.log('删除响应:', res.data)
      if (res.statusCode === 200 && res.data?.code === 200) {
        Taro.showToast({ title: '删除成功', icon: 'success' })
        setDeleteTarget(null)
        fetchRecords()
      } else {
        Taro.showToast({ title: '删除失败', icon: 'none' })
      }
    } catch (err) {
      console.error('删除异常:', err)
      Taro.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteTarget, fetchRecords])

  /* ── 导出CSV ── */
  const handleExport = useCallback(async () => {
    try {
      const res = await Network.request({
        url: '/api/event-registration/export',
        method: 'GET',
      })
      console.log('导出响应:', res.data)
      if (res.statusCode === 200 && res.data?.code === 200 && res.data?.data?.csv) {
        const csv = res.data.data.csv as string
        // 在小程序中写入临时文件并分享
        const fs = Taro.getFileSystemManager()
        const filePath = `${Taro.env.USER_DATA_PATH}/报名名单_${Date.now()}.csv`
        fs.writeFileSync(filePath, csv, 'utf8')
        Taro.showModal({
          title: '导出成功',
          content: `共${records.length}条记录，文件已保存`,
          showCancel: false,
        })
      } else {
        Taro.showToast({ title: '导出失败', icon: 'none' })
      }
    } catch (err) {
      console.error('导出异常:', err)
      Taro.showToast({ title: '网络异常', icon: 'none' })
    }
  }, [records.length])

  /* ── 登录界面 ── */
  if (!isLoggedIn) {
    return (
      <View className="min-h-screen bg-[#F5F6FA] flex flex-col items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, #1B2A4A, #2D4A7A)' }}>
          <Shield size={36} color="#C9A96E" />
        </View>
        <Text className="block text-lg font-bold text-[#1A1D2E] mb-1">管理后台</Text>
        <Text className="block text-sm text-gray-500 mb-6">请输入管理员密码</Text>
        <View className="w-full max-w-sm bg-white rounded-2xl px-4 py-3 flex flex-row items-center gap-2 shadow-sm">
          <View className="flex-1">
            <Input
              className="w-full bg-transparent text-sm"
              type={showPwd ? 'text' : 'safe-password'}
              placeholder="请输入密码"
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
              onConfirm={handleLogin}
            />
          </View>
          <View onClick={() => setShowPwd(!showPwd)} className="px-1">
            {showPwd ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
          </View>
        </View>
        <View className="w-full max-w-sm mt-4">
          <Button
            className="w-full h-11 rounded-xl text-base font-semibold"
            style={{ background: 'linear-gradient(90deg, #1B2A4A, #2D4A7A)', color: '#fff' }}
            onClick={handleLogin}
          >
            登录
          </Button>
        </View>
      </View>
    )
  }

  /* ── 统计 ── */
  const total = records.length
  const maleCount = records.filter(r => r.gender === '男').length
  const femaleCount = records.filter(r => r.gender === '女').length
  const industryMap: Record<string, number> = {}
  records.forEach(r => { industryMap[r.industry] = (industryMap[r.industry] || 0) + 1 })
  const topIndustry = Object.entries(industryMap).sort((a, b) => b[1] - a[1])[0]

  /* ── 主界面 ── */
  return (
    <View className="min-h-screen bg-[#F5F6FA]">
      {/* 顶部栏 */}
      <View className="px-4 pt-3 pb-3 flex flex-row items-center justify-between" style={{ background: 'linear-gradient(135deg, #1B2A4A, #2D4A7A)' }}>
        <Text className="block text-white text-base font-semibold">报名管理</Text>
        <View onClick={() => { setIsLoggedIn(false); setPassword('') }}>
          <LogOut size={20} color="#E8D5A8" />
        </View>
      </View>

      <View className="px-4 pt-4 pb-8">
        {/* 统计卡片 */}
        <View className="flex flex-row gap-2 mb-3">
          <Card className="flex-1 border-none shadow-sm">
            <CardContent className="p-3 flex flex-col items-center">
              <Users size={20} color="#1B2A4A" />
              <Text className="block text-xl font-bold text-[#1A1D2E] mt-1">{total}</Text>
              <Text className="block text-xs text-gray-500">报名总人数</Text>
            </CardContent>
          </Card>
          <Card className="flex-1 border-none shadow-sm">
            <CardContent className="p-3 flex flex-col items-center">
              <Text className="block text-lg font-bold text-[#1B2A4A] mt-1">{maleCount}</Text>
              <Text className="block text-xs text-gray-500">男</Text>
              <View style={{ height: '1px', width: '60%', background: '#E8EAF0', margin: '2px 0' }} />
              <Text className="block text-lg font-bold text-[#C9A96E]">{femaleCount}</Text>
              <Text className="block text-xs text-gray-500">女</Text>
            </CardContent>
          </Card>
          <Card className="flex-1 border-none shadow-sm">
            <CardContent className="p-3 flex flex-col items-center">
              <Building size={20} color="#C9A96E" />
              <Text className="block text-sm font-bold text-[#1A1D2E] mt-1">{topIndustry ? topIndustry[0] : '-'}</Text>
              <Text className="block text-xs text-gray-500">热门行业</Text>
            </CardContent>
          </Card>
        </View>

        {/* 搜索和操作 */}
        <View className="flex flex-row items-center gap-2 mb-3">
          <View className="flex-1 bg-white rounded-xl px-3 py-2 flex flex-row items-center gap-2 shadow-sm">
            <Search size={16} color="#6B7280" />
            <View className="flex-1">
              <Input
                className="w-full bg-transparent text-sm"
                placeholder="搜索姓名/电话/行业"
                value={keyword}
                onInput={(e) => handleSearch(e.detail.value)}
              />
            </View>
          </View>
          <View className="flex flex-row gap-1">
            <Button
              size="sm"
              className="rounded-xl bg-[#1B2A4A] text-white h-9"
              onClick={handleExport}
            >
              <Download size={14} color="#fff" />
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-white text-[#1A1D2E] h-9 border border-[#E8EAF0]"
              onClick={fetchRecords}
            >
              刷新
            </Button>
          </View>
        </View>

        {/* 列表 */}
        {loading ? (
          <View className="flex items-center justify-center py-12">
            <Text className="block text-sm text-gray-400">加载中...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex items-center justify-center py-12">
            <Text className="block text-sm text-gray-400">{keyword ? '没有找到匹配的记录' : '暂无报名数据'}</Text>
          </View>
        ) : (
          <View className="flex flex-col gap-2">
            {filtered.map((r) => (
              <Card key={r.id} className="border-none shadow-sm">
                <CardContent className="p-3">
                  <View className="flex flex-row items-start justify-between">
                    <View className="flex-1">
                      <View className="flex flex-row items-center gap-2 mb-1">
                        <Text className="block text-sm font-semibold text-[#1A1D2E]">{r.name}</Text>
                        <View className="px-2 py-1 rounded" style={{ backgroundColor: r.gender === '男' ? '#EDF0F4' : '#FDF2F8' }}>
                          <Text className="text-xs" style={{ color: r.gender === '男' ? '#1B2A4A' : '#EC4899' }}>{r.gender}</Text>
                        </View>
                        <View className="px-2 py-1 rounded" style={{ backgroundColor: '#FFF8EB' }}>
                          <Text className="text-xs text-[#C9A96E]">{r.industry}</Text>
                        </View>
                      </View>
                      <Text className="block text-xs text-gray-500">电话：{r.phone}</Text>
                      {r.contact_method && <Text className="block text-xs text-gray-500">联系：{r.contact_method}</Text>}
                      <View className="flex flex-row items-center gap-3 mt-1">
                        <Text className="block text-xs text-gray-400">生日：{r.birthday}{r.age ? `（${r.age}岁）` : ''}</Text>
                        {r.referrer && <Text className="block text-xs text-gray-400">引荐：{r.referrer}</Text>}
                      </View>
                      <Text className="block text-xs text-gray-300 mt-1">报名时间：{new Date(r.created_at).toLocaleString('zh-CN')}</Text>
                    </View>
                    <View onClick={() => setDeleteTarget(r)} className="px-2 py-1">
                      <Trash size={16} color="#EF4444" />
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        <Text className="block text-xs text-gray-300 text-center mt-4">共 {filtered.length} 条记录</Text>
      </View>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <Text className="block text-sm text-gray-600">
            确定要删除 <Text className="font-semibold text-[#1A1D2E]">{deleteTarget?.name}</Text> 的报名信息吗？此操作不可撤销。
          </Text>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
