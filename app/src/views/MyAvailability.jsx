import { useState } from 'react'
import { Card, Button, Input, Select, Label, Heading, SectionLabel, Page } from '@ecommons/ui'
import { useCommunity } from '../context/CommunityContext'
import { useSetTopBarSlot } from '../context/TopBarSlotContext'
import { setMyAvailability } from '../api/client'
import styles from './MyAvailability.module.css'

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
        <div className={`row ${styles.statusBox}`}>
          <span className={`emoji-mono ${styles.statusEmoji}`}>{current.type.emoji}</span>
          <div>
            <div className={styles.statusName}>{current.type.name}</div>
            {current.reason && <div className={styles.statusReason}>{current.reason}</div>}
            {current.until && <div className={styles.statusUntil}>Until {new Date(current.until).toLocaleDateString()}</div>}
          </div>
        </div>
      )}

      {!current && (
        <div className={styles.noStatusBox}>
          You are currently marked as available in {community?.name}.
        </div>
      )}

      <Card className={styles.formCard}>
        <SectionLabel className={styles.sectionLabelMb20}>
          Set status
        </SectionLabel>
        <form onSubmit={handleSet} className={`stack ${styles.form}`}>
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
          <div className="row">
            <Button type="submit" disabled={saving || !form.type_id}>
              {saving ? 'Saving…' : 'Set status'}
            </Button>
            {current && (
              <Button type="button" variant="secondary" onClick={handleClear} disabled={saving}>
                Clear status
              </Button>
            )}
            {saveMsg && (
              <span className={styles.saveMsg} style={{ color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>
                {saveMsg}
              </span>
            )}
          </div>
        </form>
      </Card>
    </Page>
  )
}
