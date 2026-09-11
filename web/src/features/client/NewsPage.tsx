import { useState } from 'react'
import { Heart, Trophy } from 'lucide-react'
import { useClubPosts, useLeaderboard, useMe } from '../../hooks/useClientApi'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Card, SectionTitle, Tabs } from '../../components/ui/Primitives'
import { formatDateLong, formatMoney, getInitials } from '../../lib/format'

type LoadPeriod = 'day' | 'week' | 'month'

const PERIOD_LABEL: Record<LoadPeriod, string> = { day: 'За день', week: 'За неделю', month: 'За месяц' }
const TYPE_LABEL: Record<string, { label: string; tone: 'accent' | 'success' | 'neutral' }> = {
  NEWS: { label: 'Новость', tone: 'neutral' },
  PHOTO: { label: 'Фото', tone: 'accent' },
  VIDEO: { label: 'Видео', tone: 'accent' },
  ACHIEVEMENT: { label: 'Достижение', tone: 'success' },
}

export function NewsPage() {
  const { data: client } = useMe()
  const [period, setPeriod] = useState<LoadPeriod>('week')
  const { data: leaderboard } = useLeaderboard(period)
  const { data: posts } = useClubPosts()

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div>
        <h1 className="text-xl font-bold">Новости клуба</h1>
        <p className="text-sm text-[var(--text-muted)]">Что происходит в клубе и рейтинг по нагрузке</p>
      </div>

      <Card>
        <SectionTitle title="Рейтинг по нагрузке" action={<Trophy size={18} className="text-[var(--accent-strong)]" />} />
        <Tabs value={period} onChange={setPeriod} options={(['day', 'week', 'month'] as LoadPeriod[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
        <div className="mt-3 flex flex-col gap-2">
          {(leaderboard ?? []).length === 0 && <p className="text-sm text-[var(--text-faint)]">Пока нет тренировок за этот период</p>}
          {(leaderboard ?? []).map((row, i) => (
            <div key={row.clientId} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${row.clientId === client?.id ? 'bg-[var(--accent-soft)]' : ''}`}>
              <span className="w-4 text-xs font-semibold text-[var(--text-faint)]">{i + 1}</span>
              <Avatar initials={getInitials(row.name)} hue={row.avatarHue} size={30} />
              <span className="flex-1 text-sm font-medium">{row.name}</span>
              <span className="text-sm text-[var(--text-muted)]">{formatMoney(row.kg)} кг</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {(posts ?? []).map((post) => {
          const typeInfo = TYPE_LABEL[post.type]
          return (
            <Card key={post.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar initials="SG" hue={210} size={32} />
                  <div>
                    <div className="text-sm font-medium">{post.authorName}</div>
                    <div className="text-[11px] text-[var(--text-faint)]">{post.authorRole} · {formatDateLong(post.date)}</div>
                  </div>
                </div>
                <Badge tone={typeInfo.tone}>{typeInfo.label}</Badge>
              </div>
              <h3 className="text-sm font-semibold">{post.title}</h3>
              <p className="text-sm text-[var(--text-muted)]">{post.text}</p>
              {post.media.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {post.media.map((m) => (
                    <img key={m.id} src={m.url} alt={m.caption ?? ''} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-[var(--text-faint)]">
                <Heart size={13} /> {post.likes}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
