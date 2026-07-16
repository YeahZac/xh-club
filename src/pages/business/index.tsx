import { useState, useEffect } from "react"
import { Image, View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  Search, MapPin, ListFilter, Eye
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { getResponseList } from "@/lib/api-response"
import { stripHtml } from "@/lib/rich-html"
import { Network } from "@/network"

interface BusinessItem {
  id: string
  title: string
  summary?: string
  content?: string
  cover_image?: string
  category: string
  industry?: string
  region?: string
  amount_min?: number
  amount_max?: number
  stage?: string
  view_count?: number
  status: string
  created_at?: string
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

const categoryMap: Record<string, string> = {
  roadshow: '项目路演',
  financing: '融资招募',
  resource: '资源对接',
}

const isCloudStorageImageUrl = (url?: string) =>
  !!url && /^https:\/\/[^/]*(?:\.myqcloud\.com|\.tcb\.qcloud\.la)/i.test(url)

const BusinessPage = () => {
  const [activeTab, setActiveTab] = useState("roadshow")
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? (Taro.getWindowInfo().statusBarHeight || 22) : 44

  const [roadshowList, setRoadshowList] = useState<BusinessItem[]>([])
  const [financingList, setFinancingList] = useState<BusinessItem[]>([])
  const [resourceList, setResourceList] = useState<BusinessItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [roadshowRes, financingRes, resourceRes] = await Promise.all([
        Network.request({ url: '/api/business?category=roadshow&pageSize=50' }),
        Network.request({ url: '/api/business?category=financing&pageSize=50' }),
        Network.request({ url: '/api/business?category=resource&pageSize=50' }),
      ])
      console.log('[商机页] roadshow:', roadshowRes?.data)
      console.log('[商机页] financing:', financingRes?.data)
      console.log('[商机页] resource:', resourceRes?.data)

      setRoadshowList(getResponseList<BusinessItem>(roadshowRes?.data?.data))
      setFinancingList(getResponseList<BusinessItem>(financingRes?.data?.data))
      setResourceList(getResponseList<BusinessItem>(resourceRes?.data?.data))
    } catch (err) {
      console.error('[商机页] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (min?: number, max?: number) => {
    if (!min && !max) return ''
    if (min && max) return `${min / 10000}-${max / 10000}万`
    return `${((min || max) || 0) / 10000}万`
  }

  const getSummary = (item: BusinessItem) => {
    if (item.summary) return item.summary
    return stripHtml(item.content).slice(0, 60)
  }

  const openDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/content-detail/index?type=business&id=${id}` })
  }

  const renderBusinessCard = (item: BusinessItem, variant: 'roadshow' | 'financing' | 'resource') => {
    const gradient =
      variant === 'roadshow'
        ? 'from-[#1B2A4A] to-[#3B5998]'
        : variant === 'financing'
          ? 'from-[#2D4A7A] to-[#4A6FA5]'
          : 'from-[#1B2A4A] to-[#2D4A7A]'

    return (
      <Card
        key={item.id}
        className="shadow-sm border-0 overflow-hidden"
        onClick={() => openDetail(item.id)}
      >
        {isCloudStorageImageUrl(item.cover_image) && (
          <Image src={item.cover_image!} mode="aspectFill" className="w-full aspect-video" />
        )}
        <View className={`bg-gradient-to-br ${gradient} p-5 relative overflow-hidden`}>
          <View className="absolute -right-8 -top-8 w-28 h-28 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
          <View className="flex flex-row items-center justify-between mb-3">
            <Badge className="bg-[#C9A96E] text-white text-[10px] px-2 py-0">
              {stageMap[item.stage || ''] || categoryMap[item.category] || item.category}
            </Badge>
            <View className="flex flex-row items-center gap-1">
              <Eye size={12} color="rgba(255,255,255,0.7)" />
              <Text className="block text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.view_count || 0}次浏览</Text>
            </View>
          </View>
          <Text className="block text-white font-bold text-base mb-1">{item.title}</Text>
          <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{getSummary(item)}</Text>
        </View>
        <CardContent className="p-4">
          <View className="flex flex-row items-center justify-between mb-3">
            <View className="flex flex-row items-center gap-2">
              {item.industry && (
                <Badge className="bg-gray-100 text-gray-600 text-[10px] px-1 py-0">
                  {industryMap[item.industry] || item.industry}
                </Badge>
              )}
              {item.region && (
                <View className="flex flex-row items-center gap-1">
                  <MapPin size={10} color="#9CA3AF" />
                  <Text className="block text-xs text-gray-400">{item.region}</Text>
                </View>
              )}
            </View>
            {formatAmount(item.amount_min, item.amount_max) && (
              <Text className="block text-sm font-bold text-[#C9A96E]">{formatAmount(item.amount_min, item.amount_max)}</Text>
            )}
          </View>
          <Button size="sm" className="w-full bg-[#1B2A4A] text-white text-xs h-8 rounded-lg">
            了解详情
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-4">
        <View style={{ height: `${statusBarHeight}px` }} />
        {isMiniApp && <Text className="block text-xl font-bold text-white mb-3">商机</Text>}
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

          <TabsContent value="roadshow">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-4 pb-8">
                {roadshowList.map((item) => renderBusinessCard(item, 'roadshow'))}
                {roadshowList.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-16">
                    <Text className="block text-sm text-gray-400">暂无路演项目</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>

          <TabsContent value="financing">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-4 pb-8">
                {financingList.map((item) => renderBusinessCard(item, 'financing'))}
                {financingList.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-16">
                    <Text className="block text-sm text-gray-400">暂无融资招募</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>

          <TabsContent value="resource">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-4 pb-8">
                {resourceList.map((item) => renderBusinessCard(item, 'resource'))}
                {resourceList.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-16">
                    <Text className="block text-sm text-gray-400">暂无资源对接</Text>
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
