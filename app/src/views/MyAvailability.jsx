import { useState } from 'react'
import { Card, Button, Input, Select, Label, Heading, SectionLabel, Page } from '@ecommons/ui'
import { useCommunity } from '../context/CommunityContext'
import { useSetTopBarSlot } from '../context/TopBarSlotContext'
import { setMyAvailability } from '../api/client'

export default function MyAvailability() {
  const { communityId, community, availabilityTypes, myMembership, refresh } = useCommunity()

  const current = myMembership?.availability ?? null

  const [form, setForm] = useState({
    type_id: current?.type.id || '',
    reason: current?.reason || '',
    until: current?.until ? current.until.slice(0, 10) : '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  async function handleSet(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      await setMyAvailability(communityId, {
        type_id: form.type_id || undefined,
        reason: form.reason || undefined,
        until: form.until || undefined,
      })
      await refresh()
      setSaveMsg('Saved!')
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    setSaveMsg('')
    try {
      await setMyAvailability(communityId, { clear: true })
      await refresh()
      setForm({ type_id: '', reason: '', until: '' })
      setSaveMsg('Cleared.')
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  useSetTopBarSlot(
    <Heading>My availability</Heading>
  )

  return (
    <Page maxWidth={520}>
      {current && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-10)',
          background: 'var(--color-sand)', borderRadius: 0, padding: '12px 18px', marginBottom: 'var(--space-20)',
          fontSize: '0.95rem',
        }}>
          <span className="emoji-mono" style={{ fontSize: '1.3rem' }}>{current.type.emoji}</span>
          <div>
            <div style={{ fontWeight: 600 }}>{current.type.name}</div>
            {current.reason && <div style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>{current.reason}</div>}
            {current.until && <div style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)' }}>Until {new Date(current.until).toLocaleDateString()}</div>}
          </div>
        </div>
      )}

      {!current && (
        <div style={{
          background: 'var(--color-cream-dark)', borderRadius: 0, padding: '12px 18px', marginBottom: 'var(--space-20)',
          fontSize: '0.9rem', color: 'var(--color-charcoal-light)',
        }}>
          You are currently marked as available in {community?.name}.
        </div>
      )}

      <Card style={{ padding: 'var(--space-28)' }}>
        <SectionLabel style={{ margin: '0 0 var(--space-20)' }}>
          Set status
        </SectionLabel>
        <form onSubmit={handleSet} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-14)' }}>
          <div>
            <Label>Status</Label>
            <Select value={form.type_id} onChange={(e) => setForm((f) => ({ ...f, type_id: e.target.value }))}>
              <option value="">Available (no status)</option>
              {availabilityTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Short note…" />
          </div>
          <div>
            <Label>Until (optional)</Label>
            <Input type="date" value={form.until} onChange={(e) => setForm((f) => ({ ...f, until: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
            <Button type="submit" disabled={saving || !form.type_id}>
              {saving ? 'Saving…' : 'Set status'}
            </Button>
            {current && (
              <Button type="button" variant="secondary" onClick={handleClear} disabled={saving}>
                Clear status
              </Button>
            )}
            {saveMsg && (
              <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>
                {saveMsg}
              </span>
            )}
          </div>
        </form>
      </Card>
    </Page>
  )
}
