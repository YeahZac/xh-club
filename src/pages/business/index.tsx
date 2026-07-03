import { useState, useEffect } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  Search, MapPin,
  ListFilter, Eye
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Network } from "@/network"

/* ── Types ── */
interface ProjectItem {
  id: string
  title: string
  description: string
  cover_image: string
  industry: string
  stage: string
  amount_min: number
  amount_max: number
  amount_raised: number
  status: string
  owner_name: string
  owner_company: string
  view_count: number
  is_featured: boolean
  created_at: string
}

interface ResourceItem {
  id: string
  title: string
  type: string
  category: string
  industry: string
  description: string
  region: string
  member_name: string
  member_company: string
  created_at: string
}

const stageMap: Record<string, string> = {
  seed: '种子期', angel: '天使轮', a: 'A轮', 'a_plus': 'A+轮', b: 'B轮', c: 'C轮', pre_ipo: 'Pre-IPO', ipo: '已上市',
}

const industryMap: Record<string, string> = {
  tech: '科技互联网', finance: '金融资本', manufacture: '先进制造', health: '大健康',
  realestate: '房地产建筑', education: '教育培训', media: '文化传媒', law: '法律服务',
  agriculture: '现代农业', crossborder: '跨境贸易', food: '餐饮消费', energy: '环保能源',
  service: '综合服务',
}

const BusinessPage = () => {
  const [activeTab, setActiveTab] = useState("roadshow")
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8

  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [financing, setFinancing] = useState<ProjectItem[]>([])
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [projectsRes, resourcesRes] = await Promise.all([
        Network.request({ url: '/api/events' }),
        Network.request({ url: '/api/community/resources' }),
      ])
      console.log('[商机页] projects:', projectsRes?.data)
      console.log('[商机页] resources:', resourcesRes?.data)

      if (projectsRes?.data?.data) {
        setProjects(projectsRes.data.data.slice(0, 20))
        setFinancing(projectsRes.data.data.slice(0, 10))
      }
      if (resourcesRes?.data?.data) setResources(resourcesRes.data.data.slice(0, 20))
    } catch (err) {
      console.error('[商机页] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (min: number, max: number) => {
    if (!min && !max) return '面议'
    if (min && max) return `${min / 10000}-${max / 10000}万`
    return `${(min || max) / 10000}万`
  }

  const calcProgress = (raised: number, min: number, max: number) => {
    const target = max || min || 1
    return Math.min(Math.round((raised / target) * 100), 100)
  }

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      {/* ── Header ── */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-4">
        <View style={{ height: `${statusBarHeight}px` }} />
        <Text className="block text-xl font-bold text-white mb-3">商机</Text>
        <View className="flex flex-row items-center gap-2">
          <View className="flex-1 rounded-xl px-3 py-2 flex flex-row items-center gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <Search size={16} color="rgba(255,255,255,0.6)" />
            <Text className="block text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>搜索项目、融资、资源...</Text>
          </View>
          <View className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <ListFilter size={18} color="#ffffff" />
          </View>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View className="px-4 -mt-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white rounded-xl shadow-sm w-full flex flex-row justify-around p-1 h-auto">
            <TabsTrigger value="roadshow" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              项目路演
            </TabsTrigger>
            <TabsTrigger value="financing" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              融资招募
            </TabsTrigger>
            <TabsTrigger value="resource" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              资源对接
            </TabsTrigger>
          </TabsList>

          {/* Roadshow Tab */}
          <TabsContent value="roadshow">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-4 pb-8">
                {projects.map((item) => (
                  <Card key={item.id} className="shadow-sm border-0 overflow-hidden">
                    <View className="bg-gradient-to-br from-[#1B2A4A] to-[#3B5998] p-5 relative overflow-hidden">
                      <View className="absolute -right-8 -top-8 w-28 h-28 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      <View className="absolute right-4 bottom-2 w-16 h-16 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      <View className="flex flex-row items-center justify-between mb-3">
                        <Badge className="bg-[#C9A96E] text-white text-[10px] px-2 py-0">{stageMap[item.stage] || item.stage}</Badge>
                        <View className="flex flex-row items-center gap-1">
                          <Eye size={12} color="rgba(255,255,255,0.7)" />
                          <Text className="block text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.view_count || 0}人关注</Text>
                        </View>
                      </View>
                      <Text className="block text-white font-bold text-base mb-1">{item.title}</Text>
                      <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.description?.slice(0, 50) || ''}</Text>
                    </View>
                    <CardContent className="p-4">
                      <View className="flex flex-row items-center justify-between mb-3">
                        <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.owner_company || ''}</Text>
                        <Badge className="bg-gray-100 text-gray-600 text-[10px] px-1 py-0">{industryMap[item.industry] || item.industry || '综合'}</Badge>
                      </View>
                      <View className="mb-3">
                        <View className="flex flex-row items-center justify-between mb-1">
                          <Text className="block text-xs text-gray-500">融资进度</Text>
                          <Text className="block text-xs font-semibold text-[#C9A96E]">{calcProgress(item.amount_raised, item.amount_min, item.amount_max)}%</Text>
                        </View>
                        <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <View className="h-full bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8] rounded-full" style={{ width: `${calcProgress(item.amount_raised, item.amount_min, item.amount_max)}%` }} />
                        </View>
                      </View>
                      <View className="flex flex-row items-center justify-between">
                        <Text className="block text-sm font-bold text-[#C9A96E]">融资{formatAmount(item.amount_min, item.amount_max)}</Text>
                        <Button size="sm" className="bg-[#1B2A4A] text-white text-xs h-7 rounded-lg">了解详情</Button>
                      </View>
                    </CardContent>
                  </Card>
                ))}
                {projects.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-16">
                    <Text className="block text-sm text-gray-400">暂无路演项目</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>

          {/* Financing Tab */}
          <TabsContent value="financing">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-4 pb-8">
                {financing.map((item) => (
                  <Card key={item.id} className="shadow-sm border-0 overflow-hidden">
                    <View className="bg-gradient-to-br from-[#2D4A7A] to-[#4A6FA5] p-5 relative overflow-hidden">
                      <View className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      <View className="flex flex-row items-center justify-between mb-2">
                        <Badge className="bg-[#C9A96E] text-white text-[10px] px-2 py-0">{stageMap[item.stage] || item.stage}</Badge>
                      </View>
                      <Text className="block text-white font-bold text-base mb-1">{item.title}</Text>
                      <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.description?.slice(0, 50) || ''}</Text>
                    </View>
                    <CardContent className="p-4">
                      <View className="flex flex-row items-center justify-between mb-3">
                        <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.owner_company || ''}</Text>
                        <Badge className="bg-gray-100 text-gray-600 text-[10px] px-1 py-0">{industryMap[item.industry] || item.industry}</Badge>
                      </View>
                      <View className="flex flex-row items-center justify-between">
                        <View>
                          <Text className="block text-xs text-gray-400">目标金额</Text>
                          <Text className="block text-sm font-bold text-[#1A1D2E]">{formatAmount(item.amount_min, item.amount_max)}</Text>
                        </View>
                        <View className="text-right">
                          <Text className="block text-xs text-gray-400">已融</Text>
                          <Text className="block text-sm font-bold text-[#C9A96E]">{calcProgress(item.amount_raised, item.amount_min, item.amount_max)}%</Text>
                        </View>
                      </View>
                      <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                        <View className="h-full bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8] rounded-full" style={{ width: `${calcProgress(item.amount_raised, item.amount_min, item.amount_max)}%` }} />
                      </View>
                    </CardContent>
                  </Card>
                ))}
                {financing.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-16">
                    <Text className="block text-sm text-gray-400">暂无融资项目</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>

          {/* Resource Tab */}
          <TabsContent value="resource">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-3 pb-8">
                {resources.map((item) => (
                  <Card key={item.id} className="shadow-sm border-0">
                    <CardContent className="p-4">
                      <View className="flex flex-row items-start justify-between mb-2">
                        <View className="flex-1 mr-3">
                          <View className="flex flex-row items-center gap-2 mb-1">
                            <Badge className={`${item.type === 'demand' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'} text-[10px] px-1 py-0`}>
                              {item.type === 'demand' ? '需求' : '供给'}
                            </Badge>
                            <Badge className="bg-gray-100 text-gray-500 text-[10px] px-1 py-0">{industryMap[item.industry] || item.industry || '综合'}</Badge>
                          </View>
                          <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.title}</Text>
                          {item.description && <Text className="block text-xs text-gray-500 mt-1">{item.description.slice(0, 60)}</Text>}
                        </View>
                      </View>
                      <View className="flex flex-row items-center gap-2 pt-2 border-t border-[#E8EAF0]">
                        <Text className="block text-xs text-gray-400">{item.member_name || '匿名'}</Text>
                        <Text className="block text-xs text-gray-300">·</Text>
                        <Text className="block text-xs text-gray-400">{item.member_company || ''}</Text>
                        {item.region && (
                          <>
                            <Text className="block text-xs text-gray-300">·</Text>
                            <MapPin size={10} color="#9CA3AF" />
                            <Text className="block text-xs text-gray-400">{item.region}</Text>
                          </>
                        )}
                      </View>
                    </CardContent>
                  </Card>
                ))}
                {resources.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-16">
                    <Text className="block text-sm text-gray-400">暂无资源信息</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>
        </Tabs>
      </View>
      <View className="h-16" />
    </View>
  )
}

export default BusinessPage
