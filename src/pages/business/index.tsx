import { useMemo, useState, useEffect } from "react"
import { Image, View, Text, ScrollView } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import {
  Search, MapPin, ListFilter, Eye
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { getResponseList } from "@/lib/api-response"
import { isDisplayableImageUrl } from "@/lib/media-url"
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
  start_time?: string | null
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

const getBusinessSortTime = (item: BusinessItem) => {
  const raw = item.start_time || item.created_at || ''
  const ts = new Date(raw).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

const sortBusinessByStartTimeDesc = (list: BusinessItem[]) =>
  [...list].sort((a, b) => getBusinessSortTime(b) - getBusinessSortTime(a))

const BusinessPage = () => {
  const [activeTab, setActiveTab] = useState("all")
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? (Taro.getWindowInfo().statusBarHeight || 22) : 44

  const [roadshowList, setRoadshowList] = useState<BusinessItem[]>([])
  const [financingList, setFinancingList] = useState<BusinessItem[]>([])
  const [resourceList, setResourceList] = useState<BusinessItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  useDidShow(() => {
    const initialTab = String(Taro.getStorageSync('business_initial_tab') || '')
    if (initialTab === 'all' || initialTab === 'roadshow' || initialTab === 'financing' || initialTab === 'resource') {
      setActiveTab(initialTab)
      Taro.removeStorageSync('business_initial_tab')
    }
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const [roadshowRes, financingRes, resourceRes] = await Promise.all([
        Network.request({ url: '/api/business?category=roadshow&pageSize=50' }),
        Network.request({ url: '/api/business?category=financing&pageSize=50' }),
        Network.request({ url: '/api/business?category=resource&pageSize=50' }),
      ])

      setRoadshowList(sortBusinessByStartTimeDesc(getResponseList<BusinessItem>(roadshowRes?.data?.data)))
      setFinancingList(sortBusinessByStartTimeDesc(getResponseList<BusinessItem>(financingRes?.data?.data)))
      setResourceList(sortBusinessByStartTimeDesc(getResponseList<BusinessItem>(resourceRes?.data?.data)))
    } catch (err) {
      console.error('[商机页] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const allList = useMemo(
    () => sortBusinessByStartTimeDesc([...roadshowList, ...financingList, ...resourceList]),
    [roadshowList, financingList, resourceList],
  )

  const formatAmount = (min?: number, max?: number) => {
    if (!min && !max) return ''
    if (min && max) return `${min / 10000}-${max / 10000}万`
    return `${((min || max) || 0) / 10000}万`
  }

  const getSummary = (item: BusinessItem) => {
    if (item.summary) return item.summary
    return stripHtml(item.content).slice(0, 48)
  }

  const openDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/content-detail/index?type=business&id=${id}` })
  }

  const renderBusinessCard = (item: BusinessItem, showCategory = false) => {
    const coverOk = isDisplayableImageUrl(item.cover_image)
    const amountText = formatAmount(item.amount_min, item.amount_max)
    const badgeText = showCategory
      ? (categoryMap[item.category] || item.category)
      : (stageMap[item.stage || ''] || categoryMap[item.category] || item.category)
    const summary = getSummary(item)

    return (
      <Card
        key={`${item.category}-${item.id}`}
        className="shadow-sm border-0 overflow-hidden"
        onClick={() => openDetail(item.id)}
      >
        <CardContent className="p-2.5">
          <View className="flex flex-row gap-2.5 items-stretch">
            <View className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
              {coverOk ? (
                <Image src={item.cover_image!} mode="aspectFill" className="w-full h-full" />
              ) : (
                <View className="w-full h-full bg-gradient-to-br from-[#1B2A4A] to-[#3B5998] flex items-center justify-center px-1.5">
                  <Text className="block text-white text-xs font-semibold text-center">{item.title}</Text>
                </View>
              )}
            </View>
            <View className="flex-1 min-w-0 flex flex-col justify-between">
              <View>
                <View className="flex flex-row items-start justify-between gap-1.5">
                  <Text className="block text-xs font-semibold text-[#1A1D2E] leading-snug flex-1 line-clamp-2">{item.title}</Text>
                  <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1.5 py-0 flex-shrink-0">
                    {badgeText}
                  </Badge>
                </View>
                {summary ? (
                  <Text className="block text-xs text-gray-500 leading-snug line-clamp-1 mt-0.5">{summary}</Text>
                ) : null}
              </View>
              {/* 与融资招募一致：金额/标签、浏览、详情同一行，不额外占行 */}
              <View className="flex flex-row items-center justify-between gap-1.5 mt-1">
                <View className="flex flex-row items-center gap-1.5 flex-1 min-w-0">
                  {amountText ? (
                    <Text className="block text-xs font-bold text-[#C9A96E] flex-shrink-0">{amountText}</Text>
                  ) : item.industry ? (
                    <Badge className="bg-gray-100 text-gray-600 text-xs px-1 py-0 flex-shrink-0">
                      {industryMap[item.industry] || item.industry}
                    </Badge>
                  ) : item.region ? (
                    <View className="flex flex-row items-center gap-0.5 flex-shrink-0">
                      <MapPin size={10} color="#9CA3AF" />
                      <Text className="block text-xs text-gray-400">{item.region}</Text>
                    </View>
                  ) : null}
                  <View className="flex flex-row items-center gap-0.5 flex-shrink-0">
                    <Eye size={11} color="#9CA3AF" />
                    <Text className="block text-xs text-gray-400">{item.view_count || 0}</Text>
                  </View>
                </View>
                <Button
                  size="sm"
                  className="bg-[#1B2A4A] text-white text-xs h-6 px-2.5 rounded-md flex-shrink-0"
                  onClick={(e) => {
                    e?.stopPropagation?.()
                    openDetail(item.id)
                  }}
                >
                  详情
                </Button>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>
    )
  }

  const renderList = (list: BusinessItem[], emptyText: string, showCategory = false) => (
    <ScrollView scrollY className="mt-3" style={{ height: 'calc(100vh - 200px)' }}>
      <View className="flex flex-col gap-2 pb-6">
        {list.map((item) => renderBusinessCard(item, showCategory))}
        {list.length === 0 && !loading && (
          <View className="flex items-center justify-center py-12">
            <Text className="block text-xs text-gray-400">{emptyText}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  )

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-3.5 pb-3">
        <View style={{ height: `${statusBarHeight}px` }} />
        {isMiniApp && <Text className="block text-lg font-bold text-white mb-2.5">商机</Text>}
        <View className="flex flex-row items-center gap-2">
          <View className="flex-1 rounded-lg px-2.5 py-1.5 flex flex-row items-center gap-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <Search size={14} color="rgba(255,255,255,0.6)" />
            <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>搜索项目、融资、资源...</Text>
          </View>
          <View className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <ListFilter size={16} color="#ffffff" />
          </View>
        </View>
      </View>

      <View className="px-3.5 -mt-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white rounded-lg shadow-sm w-full flex flex-row justify-around p-0.5 h-auto">
            <TabsTrigger value="all" className="flex-1 rounded-md data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-1.5 text-xs">
              全部
            </TabsTrigger>
            <TabsTrigger value="roadshow" className="flex-1 rounded-md data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-1.5 text-xs">
              项目路演
            </TabsTrigger>
            <TabsTrigger value="financing" className="flex-1 rounded-md data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-1.5 text-xs">
              融资招募
            </TabsTrigger>
            <TabsTrigger value="resource" className="flex-1 rounded-md data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-1.5 text-xs">
              资源对接
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {renderList(allList, '暂无商机内容', true)}
          </TabsContent>
          <TabsContent value="roadshow">
            {renderList(roadshowList, '暂无路演项目')}
          </TabsContent>
          <TabsContent value="financing">
            {renderList(financingList, '暂无融资招募')}
          </TabsContent>
          <TabsContent value="resource">
            {renderList(resourceList, '暂无资源对接')}
          </TabsContent>
        </Tabs>
      </View>
      <View className="h-16" />
    </View>
  )
}

export default BusinessPage
