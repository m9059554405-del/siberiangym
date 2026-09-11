import { useState } from 'react'
import { Heart, Send } from 'lucide-react'
import { useClubPosts } from '../../hooks/useClientApi'
import { useCreateClubPost } from '../../hooks/useStaffApi'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Button, Card, SectionTitle } from '../../components/ui/Primitives'
import type { ClubPostType } from '../../types'

const TYPE_LABEL: Record<ClubPostType, { label: string; tone: 'accent' | 'success' | 'neutral' }> = {
  NEWS: { label: 'Новость', tone: 'neutral' },
  PHOTO: { label: 'Фото', tone: 'accent' },
  VIDEO: { label: 'Видео', tone: 'accent' },
  ACHIEVEMENT: { label: 'Достижение', tone: 'success' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export function NewsComposerPage() {
  const { data: posts } = useClubPosts()
  const createPost = useCreateClubPost()

  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [type, setType] = useState<ClubPostType>('NEWS')

  const sorted = [...(posts ?? [])].sort((a, b) => b.date.localeCompare(a.date))

  function submit() {
    if (!title.trim() || !text.trim()) return
    createPost.mutate({ title: title.trim(), text: text.trim(), type }, { onSuccess: () => { setTitle(''); setText(''); setType('NEWS') } })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Новости клуба</h1>
        <p className="text-sm text-[var(--text-muted)]">Публикация новостей и объявлений в клиентское приложение</p>
      </div>

      <Card>
        <SectionTitle title="Новая публикация" subtitle="Появится в ленте клиентского приложения сразу после отправки" />
        <div className="flex flex-col gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок новости"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст новости…" rows={3}
            className="resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <div className="flex flex-wrap items-center gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as ClubPostType)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-sm">
              {(Object.keys(TYPE_LABEL) as ClubPostType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t].label}</option>)}
            </select>
            <Button size="sm" onClick={submit} disabled={!title.trim() || !text.trim() || createPost.isPending}>
              <Send size={13} /> Опубликовать
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {sorted.map((post) => {
          const typeInfo = TYPE_LABEL[post.type]
          return (
            <Card key={post.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar initials="SG" hue={210} size={32} />
                  <div>
                    <div className="text-sm font-medium">{post.authorName}</div>
                    <div className="text-[11px] text-[var(--text-faint)]">{post.authorRole} · {formatDate(post.date)}</div>
                  </div>
                </div>
                <Badge tone={typeInfo.tone}>{typeInfo.label}</Badge>
              </div>
              <h3 className="text-sm font-semibold">{post.title}</h3>
              <p className="text-sm text-[var(--text-muted)]">{post.text}</p>
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
