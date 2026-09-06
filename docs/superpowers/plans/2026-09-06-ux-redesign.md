# UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every screen of the read-only Accel IT staff app to the layouts in the design handoff, using the components and tokens the app already has.

**Architecture:** Expo Router screens under `app/` render against `app/constants/theme.js` tokens through `Theme.useTheme()`. Each screen keeps its own fetch code; only the rendering changes. Pure decisions (grouping, partitioning, formatting, URI building) live in `app/utils/*.js` with vitest tests; components stay thin. New shared primitives are added once in Task 1 and reused everywhere.

**Tech Stack:** Expo 54, React Native 0.81, React 19, expo-router 6, `@expo/vector-icons` (Ionicons, FontAwesome), `expo-clipboard`, `moment`, `libphonenumber-js`, vitest 2 (node for utils, jsdom for components).

**Spec:** `/Users/anelkujovic/Downloads/design_handoff_staff_app_redesign/README.md` (sections §1–§9). The `.dc.html` files there are HTML previews only; `Screens v2.dc.html` and `Address Book v2.dc.html` are the targets if a value in the README is unclear. `support.js` and `ios-frame.jsx` are preview runtime, ignore them.

## Global Constraints

Copied from the spec and from the product owner's instructions earlier today. Every task must honour all of them.

- **Read only.** No new endpoints, no writes to the API. Every screen uses data the app already fetches.
- **Both themes.** Every colour is a `colors.*` token from `theme.js` (light and dark palettes both define them). Never hardcode a hex except the two the spec names for auth: `#28C76F` success on the login status line.
- **Visual language unchanged.** Reuse `Card`/`CardHeader`, `SearchField`, `Pills`, `Avatar`, `LabelValue`, `RevealField`, `DetailHeader`, `ScreenState`, `StaffInfo`. Card header band is `primary+'15'`; badges and icon circles are `primary+'1A'`; radii: card 16, sheet 20, tiles 14, inputs 10–12, pills 999.
- **Row divider:** `borderTopWidth: 1, borderTopColor: colors.border` on every row except the first inside a card.
- **Standard inline action:** 38×38 circular bordered button, `borderColor: colors.border`, Ionicons 17 in `colors.primary`; disabled = `opacity: 0.3` and inert (row heights never change).
- **Truncate** means `numberOfLines={1}`.
- **Avatars:** the existing `Avatar` (`app/components/Avatar.js`), tint by id via `avatarColors`. It replaces every square `primary+'1A'` initial box.
- **Passwords are displayed, never stored.** This overrides §7 of the spec: **no copy button for the password**, the revealed text is not selectable, and `RevealField` re-masks when the app leaves the foreground. Username copy and phone-number copy are allowed.
- **Ticket age stays.** `TicketRow` keeps `#ref  (24d)` (two spaces) from `ageDays`. The spec is silent on it; the owner asked for it explicitly.
- **Code style:** 4-space indent, single quotes, JSX in `.js` files, `StyleSheet.create` at the bottom of each file, theme read via `const { useTheme } = Theme; const { theme } = useTheme(); const { colors } = theme;`. Comments explain *why*, not what.
- **Tests:** pure helpers get a vitest file under `tests/` mirroring existing ones (see `tests/phone.test.js`). Run `npx vitest run` before every commit; all files must pass. Parse-check any component the tests don't import with `npx esbuild --loader:.js=jsx --log-level=warning <files> --outdir=/tmp/esb >/dev/null`.
- **Commits:** one per task, message in the repo's `type: summary` style with a body, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Work on branch `feat/ux-redesign`. Do not push.
- **File ownership:** each task lists the only files it may create or modify. Tasks 2–6 and 8–10 run in parallel after Task 1; Task 7 runs after Task 6. Never edit another task's files; if you need something from one, it is listed under Interfaces.

---

### Task 1: Shared primitives

**Files:**
- Create: `app/components/IconButton.js`
- Create: `app/components/SectionLabel.js`
- Create: `app/components/Toast.js`
- Modify: `app/utils/phone.js` (add `smsUri`)
- Create: `app/utils/maps.js`
- Create: `app/utils/address.js`
- Test: `tests/phone.test.js` (extend), `tests/maps.test.js`, `tests/address.test.js`

**Interfaces:**
- Produces `IconButton({ icon, onPress, label, disabled, size = 17, style })` — the 38-circle bordered action. `label` is the accessibility label. Disabled renders at opacity 0.3 and ignores presses.
- Produces `SectionLabel({ children, style })` — 11/700 uppercase, letterSpacing 0.5, `colors.textSecondary`.
- Produces `Toast({ message })` and `useToast()` → `[message, show]`; `show(text)` displays for 1.8 s.
- Produces `smsUri(raw)` → `'sms:+61…'` for AU mobiles (national form starts `04` or `05`), else `null`.
- Produces `mapsUri(query)` → platform maps URL string or `null` for empty input; `mapsQuery(query)` is the pure, tested part.
- Produces `addressLine(address)` → `'address1, address2, suburbcity, state, postcode'` with blanks removed, or `null`.

- [ ] **Step 1: Failing tests for the helpers**

Append to `tests/phone.test.js`:

```js
import { smsUri } from '../app/utils/phone.js';

describe('smsUri', () => {
    it('texts an australian mobile', () => {
        expect(smsUri('0400 000 000')).toBe('sms:+61400000000');
        expect(smsUri('+61500000000')).toBe('sms:+61500000000');
    });

    it('refuses landlines and junk', () => {
        expect(smsUri('03 9000 0000')).toBeNull();
        expect(smsUri('ext 4402')).toBeNull();
        expect(smsUri(null)).toBeNull();
    });
});
```

Create `tests/maps.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mapsQuery } from '../app/utils/maps.js';

describe('mapsQuery', () => {
    it('url-encodes the address', () => {
        expect(mapsQuery('1 Main St, Cheltenham VIC 3192')).toBe('1%20Main%20St%2C%20Cheltenham%20VIC%203192');
    });

    it('returns null for nothing', () => {
        expect(mapsQuery('')).toBeNull();
        expect(mapsQuery(null)).toBeNull();
    });
});
```

Create `tests/address.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { addressLine } from '../app/utils/address.js';

describe('addressLine', () => {
    it('joins the parts that exist', () => {
        expect(addressLine({ address1: '1 Main St', address2: '', suburbcity: 'Cheltenham', state: 'VIC', postcode: '3192' }))
            .toBe('1 Main St, Cheltenham, VIC, 3192');
    });

    it('returns null when there is no address', () => {
        expect(addressLine(null)).toBeNull();
        expect(addressLine({})).toBeNull();
    });
});
```

- [ ] **Step 2: Run them, expect failures**

Run: `npx vitest run tests/phone.test.js tests/maps.test.js tests/address.test.js`
Expected: `smsUri is not a function`, `Failed to load url ../app/utils/maps.js`, `Failed to load url ../app/utils/address.js`.

- [ ] **Step 3: Implement the helpers**

Append to `app/utils/phone.js`:

```js
// SMS only makes sense to a mobile. Australian mobiles are 04xx and 05xx in
// national form; everything else (landlines, extensions, junk) gets null so
// the caller can dim its button.
export function smsUri(raw) {
    const parsed = parse(raw);

    if (!parsed?.isValid() || parsed.country !== DEFAULT_COUNTRY) return null;
    if (!/^0[45]/.test(parsed.formatNational().replace(/\s/g, ''))) return null;

    return `sms:${parsed.number}`;
}
```

Create `app/utils/maps.js`:

```js
import { Platform } from 'react-native';

export function mapsQuery(query) {
    const text = typeof query === 'string' ? query.trim() : '';

    return text ? encodeURIComponent(text) : null;
}

// Apple Maps on iOS, the geo: intent on Android, so the platform's own maps
// app opens rather than a browser tab.
export function mapsUri(query) {
    const q = mapsQuery(query);

    if (!q) return null;

    return Platform.OS === 'ios' ? `https://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`;
}
```

`react-native` is mocked in jsdom tests; `tests/maps.test.js` runs in node and imports only `mapsQuery`, so add `vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))` at the top of that test (import `vi` from vitest).

Create `app/utils/address.js`:

```js
// One line for a site address, skipping blank parts. Used by the client
// General tab and the Directions button, so both agree on the text.
export function addressLine(address) {
    if (!address) return null;

    const line = [address.address1, address.address2, address.suburbcity, address.state, address.postcode]
        .filter((part) => part && String(part).trim())
        .join(', ');

    return line || null;
}
```

- [ ] **Step 4: Components**

`app/components/IconButton.js`:

```js
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../context/ThemeContext';

// The app's one inline action: a 38pt bordered circle with a primary icon.
// Disabled buttons dim rather than disappear so row heights stay constant.
export default function IconButton({ icon, onPress, label, disabled = false, size = 17, style }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[styles.button, { borderColor: colors.border, opacity: disabled ? 0.3 : 1 }, style]}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Ionicons name={icon} size={size} color={colors.primary} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 38, height: 38, borderRadius: 19, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
});
```

`app/components/SectionLabel.js`:

```js
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';

export default function SectionLabel({ children, style }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    return <Text style={[styles.label, { color: colors.textSecondary }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
    label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
```

`app/components/Toast.js`:

```js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';

const DURATION = 1800;

export function useToast() {
    const [message, setMessage] = useState(null);
    const timer = useRef(null);

    const show = useCallback((text) => {
        clearTimeout(timer.current);
        setMessage(text);
        timer.current = setTimeout(() => setMessage(null), DURATION);
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    return [message, show];
}

// Bottom pill, inverted colours so it reads over any card. Render it last in
// the screen so it sits above the content.
export default function Toast({ message }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    if (!message) return null;

    return (
        <View pointerEvents="none" style={styles.wrap}>
            <View style={[styles.pill, { backgroundColor: colors.textPrimary }]}>
                <Text style={[styles.text, { color: colors.background }]}>{message}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, bottom: 48, alignItems: 'center' },
    pill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
    text: { fontSize: 13, fontWeight: '600' },
});
```

- [ ] **Step 5: Run tests and parse-check**

Run: `npx vitest run` — all pass.
Run: `npx esbuild --loader:.js=jsx --log-level=warning app/components/IconButton.js app/components/SectionLabel.js app/components/Toast.js app/utils/maps.js --outdir=/tmp/esb >/dev/null`

- [ ] **Step 6: Commit**

```bash
git add app/components/IconButton.js app/components/SectionLabel.js app/components/Toast.js app/utils/phone.js app/utils/maps.js app/utils/address.js tests/phone.test.js tests/maps.test.js tests/address.test.js
git commit -m "feat: add the shared primitives the redesign reuses"
```

---

### Task 2: Ticket rows and the Tickets list (§4)

**Files:**
- Modify: `app/components/TicketRow.js`
- Modify: `app/(main)/tickets.js`
- Modify: `app/utils/tickets.js`
- Test: `tests/tickets.test.js`

**Interfaces:**
- Consumes: `isMine(ticket, staff)`, `priorityColor`, `priorityLabel` (existing in `app/utils/tickets.js`); `ageDays` from `app/utils/datetime.js`.
- Produces `partitionTickets(rows, staff, total)` → `{ yours: Ticket[], others: Ticket[], othersTotal: number }` where `othersTotal = Math.max(0, total - yours.length)`.
- Produces `TicketRow({ ticket, index, showClient = true })` — the `mine` prop is removed; no "You" chip.

- [ ] **Step 1: Failing test**

`tests/tickets.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { partitionTickets } from '../app/utils/tickets.js';

const staff = { id: 5 };
const rows = [
    { id: 1, assigned_staff_id: 5 },
    { id: 2, assigned_staff_id: 9 },
    { id: 3, assigned_staff_id: '5' },
];

describe('partitionTickets', () => {
    it('splits the loaded rows into yours and everyone else', () => {
        const { yours, others } = partitionTickets(rows, staff, 80);

        expect(yours.map((t) => t.id)).toEqual([1, 3]);
        expect(others.map((t) => t.id)).toEqual([2]);
    });

    it('reports the rest of the total as everyone else', () => {
        expect(partitionTickets(rows, staff, 80).othersTotal).toBe(78);
        expect(partitionTickets(rows, staff, 1).othersTotal).toBe(0);
    });

    it('treats an unknown staff member as owning nothing', () => {
        expect(partitionTickets(rows, null, 3).yours).toEqual([]);
    });
});
```

- [ ] **Step 2: Run, expect `partitionTickets is not a function`**

- [ ] **Step 3: Implement**

Append to `app/utils/tickets.js`:

```js
// The backend sorts the current user's tickets first, so a page can be split
// client-side without a parameter the API does not have. `total` is the
// server's count for the filter; whatever is not yours is everyone else's.
export function partitionTickets(rows, staff, total) {
    const yours = [];
    const others = [];

    (rows || []).forEach((ticket) => (isMine(ticket, staff) ? yours : others).push(ticket));

    return { yours, others, othersTotal: Math.max(0, (Number(total) || 0) - yours.length) };
}
```

- [ ] **Step 4: TicketRow**

In `app/components/TicketRow.js`: remove the `mine` prop and the chip; title `numberOfLines={1}`; after the reference text, when `ticket.priority === 'C' || ticket.priority === 'H'`, render `<Text style={{ fontSize: 11, fontWeight: '700', color: priorityColor(ticket.priority, colors) }}>{priorityLabel(ticket.priority)}</Text>` inside the ref row (gap 6). Keep the dot, the `#ref  (Nd)` text and the client · age meta line. Update the header comment to say the priority word appears for Critical and High only.

- [ ] **Step 5: Tickets list**

In `app/(main)/tickets.js` replace the single card with two, using `partitionTickets(rows, staff, total)`:

- Card "Yours": `CardHeader title="Yours" meta={yours.length}`, rows `TicketRow ticket index`. **Render this card only when `yours.length > 0`.**
- Card "Everyone else": `CardHeader title="Everyone else" meta={othersTotal}`, rows from `others`.
- The FlatList still carries a single synthetic item that renders both cards in a `View` with `gap: cardGap`. Keep paging, refresh, footer spinner and the empty state exactly as they are.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run` and the esbuild parse-check on `app/components/TicketRow.js "app/(main)/tickets.js"`.

```bash
git add app/components/TicketRow.js "app/(main)/tickets.js" app/utils/tickets.js tests/tickets.test.js
git commit -m "feat: split the ticket list into yours and everyone else"
```

---

### Task 3: Ticket detail (§5)

**Files:**
- Modify: `app/ticket/[id].js`

**Interfaces:**
- Consumes: `IconButton` (Task 1), `Avatar`, `LabelValue`, `Card`/`CardHeader`, `priorityColor`, `priorityLabel`, `isMine`, `relativeTime`, `dateTime`, `formatPhone`, `dialUri`, `mailUri`, `useStaff`.
- Ticket fields (see `docs/api-contract.md` §`GET /api/tickets/{id}`): `title`, `priority`, `completed_at`, `updated_at`, `body` (HTML), `client { id, name }`, `client_contact_full_name`, `client_contact_position`, `client_contact_phone`, `client_contact_email`, `client_contact_photo`, `client_contact_id`, `assignees[] { name, staff_id }`, `created_at`, `assigned_staff_id`.

- [ ] **Step 1: Reorder and restyle**

Card order: **Summary → Description → Reported by → Details**.

Summary card (no header band; `Card` with padding `14 16`, gap 10):
- Row: priority dot 9×9 radius 4.5 in `priorityColor` + title 16/700 lineHeight 21 (wraps).
- Chip row (`flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center'`):
  - Status chip: `Open` or `Completed`, `backgroundColor: primary+'1A'`, 11/700 primary, padding `3 9`, radius 999.
  - Priority chip: `priorityLabel`, outlined `borderWidth: 1, borderColor: priorityColor`, text in the same colour, same padding/radius.
  - `You` chip (same as status chip style) when `isMine(ticket, staff)`.
  - Plain text `Updated {relativeTime(ticket.updated_at || ticket.created_at)}` 11/600 textSecondary.

Description: unchanged content, now second.

Reported by (`CardHeader title="Reported by"`): one row padding `12 16`, gap 12: `Avatar` 40 (`uri={client_contact_photo}`, `name`, `id={client_contact_id}`) · name 15/700 truncate · `"{position} · {formatPhone(phone)}"` 12 textSecondary (drop empty parts) · `IconButton icon="call-outline"` (disabled when `!dialUri(phone)`) + `IconButton icon="mail-outline"` (disabled when `!mailUri(email)`). Hide the whole card when there is no contact name.

Details: `CardHeader title="Details" meta="Open client"` where the meta is tappable and rendered in `colors.primary` — `CardHeader` accepts `children`, so pass a custom row: title Text 15/700 left, `TouchableOpacity` right with Text "Open client" 13/600 primary → `router.push('/client/' + ticket.client.id)`. Rows: `LabelValue` Client, Created (`dateTime`), Assigned (`assignees.map(a => a.name).join(', ')` or `—`), Completed (`dateTime(completed_at)`, only when set, `last`).

- [ ] **Step 2: Verify and commit**

Parse-check the file; `npx vitest run`.

```bash
git add "app/ticket/[id].js"
git commit -m "feat: lead the ticket page with a summary card"
```

---

### Task 4: Dashboard (§2)

**Files:**
- Modify: `app/(main)/index.js`
- Create: `app/utils/dashboard.js`
- Test: `tests/dashboard.test.js`

**Interfaces:**
- Consumes: `visibleMenu(staff)` (`app/utils/menu.js`), `api.clients()`, `api.tickets({ page: 1, limit: 30 })`, `api.assetOnboarding()`, `api.addressBook()`, `isMine`, `TicketRow` (Task 2 shape: `ticket`, `index`), `Card`/`CardHeader`, `useStaff`, `parseApiDate`.
- Produces `onboardedThisMonth(rows, now)` → count of rows whose `created_at` falls in `now`'s calendar month; `statLine(key, stats)` → the stat string per menu key or `null` while unknown.

- [ ] **Step 1: Failing test**

`tests/dashboard.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { onboardedThisMonth, statLine } from '../app/utils/dashboard.js';

const now = new Date('2026-09-06T10:00:00+10:00');

describe('onboardedThisMonth', () => {
    it('counts only this calendar month', () => {
        const rows = [
            { created_at: '2026-09-01 09:00:00+10' },
            { created_at: '2026-08-31 23:00:00+10' },
            { created_at: '2026-09-06T09:00:00+10:00' },
        ];

        expect(onboardedThisMonth(rows, now)).toBe(2);
    });

    it('ignores unparseable dates', () => {
        expect(onboardedThisMonth([{ created_at: null }, { created_at: 'x' }], now)).toBe(0);
    });
});

describe('statLine', () => {
    it('words each stat', () => {
        const stats = { activeClients: 41, openTickets: 80, yourTickets: 3, machinesThisMonth: 1, contacts: 212 };

        expect(statLine('clients', stats)).toBe('41 active');
        expect(statLine('tickets', stats)).toBe('80 open · 3 yours');
        expect(statLine('onboarding', stats)).toBe('1 machine this month');
        expect(statLine('address-book', stats)).toBe('212 contacts');
    });

    it('is null until the stat has loaded', () => {
        expect(statLine('clients', {})).toBeNull();
        expect(statLine('tickets', { openTickets: 4 })).toBeNull();
    });
});
```

- [ ] **Step 2: Run, expect load failure**

- [ ] **Step 3: Implement**

`app/utils/dashboard.js`:

```js
import { parseApiDate } from './datetime';

export function onboardedThisMonth(rows, now = new Date()) {
    const month = now.getMonth();
    const year = now.getFullYear();

    return (rows || []).filter((row) => {
        const parsed = parseApiDate(row?.created_at);

        return parsed && parsed.month() === month && parsed.year() === year;
    }).length;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One line under each launcher tile. Null until every number it needs is in,
// so a tile shows its label alone rather than a half-sentence.
export function statLine(key, stats = {}) {
    const has = (...names) => names.every((name) => Number.isFinite(stats[name]));

    switch (key) {
        case 'clients':
            return has('activeClients') ? `${stats.activeClients} active` : null;
        case 'tickets':
            return has('openTickets', 'yourTickets') ? `${stats.openTickets} open · ${stats.yourTickets} yours` : null;
        case 'onboarding':
            return has('machinesThisMonth') ? `${plural(stats.machinesThisMonth, 'machine', 'machines')} this month` : null;
        case 'address-book':
            return has('contacts') ? plural(stats.contacts, 'contact', 'contacts') : null;
        default:
            return null;
    }
}
```

`parseApiDate` returns a moment; `.month()` is zero-based like `Date.getMonth()`.

- [ ] **Step 4: Screen**

Rewrite `app/(main)/index.js`:

- State: `stats` object, `yourTickets` array. On mount (and when `menu` changes), for each visible menu key start its fetch independently and `catch` errors silently (a failed stat just leaves the label alone): `clients` → `api.clients()` → `activeClients = rows.filter(c => c.status === 'active').length`; `tickets` → `api.tickets({ page: 1, limit: 30 })` → `openTickets = total`, `yourTickets = rows.filter(t => isMine(t, staff))`, `yourTickets.length`; `onboarding` → `api.assetOnboarding()` → `machinesThisMonth = onboardedThisMonth(assets)`; `address-book` → `api.addressBook()` → `contacts = rows.length`. Guard with a `cancelled` flag in the effect cleanup.
- Grid: `View` with `flexDirection: 'row', flexWrap: 'wrap', gap: 10`; each tile a `Card` with `width: '48%'` (the wrap gap makes two columns), `padding: 14`, `minHeight: 96`, `justifyContent: 'space-between'`. Top row: 38 circle `primary+'1A'` with `FontAwesome` `item.icon` 17 primary; right-aligned badge (`primary+'1A'`, 12/700 primary, `minWidth: 26`, padding `2 8`, radius 999, centred) showing `yourTickets.length` on the tickets tile when > 0. Bottom: label 15/700 textPrimary, then `statLine(item.key, stats)` 12 textSecondary when not null.
- Below the grid, when `yourTickets.length > 0`: `Card` with `CardHeader title="Your open tickets" meta={yourTickets.length}` and `TicketRow`s (`ticket`, `index`).
- Footnote unchanged.

- [ ] **Step 5: Verify and commit**

```bash
git add "app/(main)/index.js" app/utils/dashboard.js tests/dashboard.test.js
git commit -m "feat: turn the dashboard into a stats grid with your open tickets"
```

---

### Task 5: Clients list (§3)

**Files:**
- Modify: `app/(main)/clients.js`
- Create: `app/utils/clients.js`
- Test: `tests/clients.test.js`

**Interfaces:**
- Consumes: `Avatar`, `IconButton` (Task 1), `Card`/`CardHeader`, `dialUri`. Client list rows carry `id, name, logo, status, phone, open_tickets, primary_site.address.suburbcity` (confirm `phone` in `docs/api-contract.md` §`GET /api/clients`; if absent, pass `null` so the button dims).
- Produces `clientMeta(client)` → `"{suburb} · {n} open ticket(s)"` with the ticket part omitted at 0, `Inactive` appended for inactive clients, `'—'` when empty.

- [ ] **Step 1: Failing test**

`tests/clients.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { clientMeta } from '../app/utils/clients.js';

const at = (suburb) => ({ primary_site: { address: { suburbcity: suburb } } });

describe('clientMeta', () => {
    it('shows suburb and open tickets', () => {
        expect(clientMeta({ ...at('Cheltenham'), open_tickets: 2 })).toBe('Cheltenham · 2 open tickets');
        expect(clientMeta({ ...at('Braeside'), open_tickets: 1 })).toBe('Braeside · 1 open ticket');
    });

    it('drops the ticket part at zero and flags inactive', () => {
        expect(clientMeta({ ...at('Clayton'), open_tickets: 0 })).toBe('Clayton');
        expect(clientMeta({ ...at('Clayton'), open_tickets: 0, status: 'inactive' })).toBe('Clayton · Inactive');
    });

    it('falls back to a dash', () => {
        expect(clientMeta({})).toBe('—');
    });
});
```

- [ ] **Step 2: Run, expect load failure**

- [ ] **Step 3: Implement**

`app/utils/clients.js`:

```js
export function clientMeta(client) {
    const open = Number(client?.open_tickets) || 0;

    return [
        client?.primary_site?.address?.suburbcity,
        open > 0 ? `${open} open ${open === 1 ? 'ticket' : 'tickets'}` : null,
        client?.status === 'inactive' ? 'Inactive' : null,
    ].filter(Boolean).join(' · ') || '—';
}
```

- [ ] **Step 4: Screen**

In `app/(main)/clients.js` keep search, pills and the local filter. Replace the per-client cards with one `Card`: `CardHeader title={FILTERS.find(f => f.value === filter).label} meta={visible.length}`, then rows (`TouchableOpacity`, padding `10 16`, gap 12, divider on `index > 0`): `Avatar uri={item.logo} name={item.name} id={item.id} size={40}` · copy (flex 1, gap 2): name 15/700 truncate, `clientMeta(item)` 12 textSecondary truncate · `IconButton icon="call-outline" label={'Call ' + item.name} disabled={!dialUri(item.phone)} onPress={() => Linking.openURL(dialUri(item.phone))}` · `chevron-forward` 18 textSecondary. Row tap → `/client/{id}` as today. Use the single-synthetic-item FlatList pattern from `app/(main)/tickets.js` so pull-to-refresh keeps working; keep `ScreenState` for empty.

- [ ] **Step 5: Verify and commit**

```bash
git add "app/(main)/clients.js" app/utils/clients.js tests/clients.test.js
git commit -m "feat: list clients in one card with avatars and a call button"
```

---

### Task 6: Address Book (§1)

**Files:**
- Modify: `app/(main)/address-book.js`
- Create: `app/components/PersonRow.js`
- Create: `app/components/ContactSheet.js`
- Create: `app/utils/addressBook.js`
- Create: `app/utils/recents.js`
- Test: `tests/addressBook.test.js`

**Interfaces:**
- Consumes: `Avatar`, `IconButton`, `SectionLabel`, `Toast`/`useToast` (Task 1), `formatPhone`, `dialUri`, `mailUri`, `smsUri`, `LabelValue`, `expo-clipboard` (`setStringAsync`), `AsyncStorage`.
- Produces `PersonRow({ person, onPress, showDivider })` — `person` is a `Person` (below). Renders `Avatar` 40 · name 15/700 truncate + `Client` badge when `person.isClient` · one meta line 12 `"{subtitle} · {formatPhone(phone)}"` · one `IconButton call-outline` disabled without `dialUri`. Used by Task 7's Contacts tab.
- Produces `ContactSheet({ person, visible, onClose, onCopied })` — bottom modal per spec §1. `onCopied(text)` fires after a copy so the screen can toast.
- Produces `toPerson(row)` (address-book row → `Person`), `sectionize(rows)`, `recentKey(row)`, `bumpRecent(keys, key, max = 8)`, `matches(row, term)`.

`Person` shape:

```js
// { key, name, subtitle, phone, email, isClient, clientId, clientName, avatarId, firstName }
```

- [ ] **Step 1: Failing tests**

`tests/addressBook.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { toPerson, sectionize, recentKey, bumpRecent, matches } from '../app/utils/addressBook.js';

const contact = { type: 'client_contact', displayname: 'Pat Smith', contact_id: 44, client_id: 12, fname: 'Pat', client_name: 'Accolade Screens', email: 'pat@accolade.com.au', phone: '0400000000' };
const general = { type: 'general_contact', displayname: 'Vendor Support', contact_id: 90, client_id: null, fname: 'Vendor', client_name: null, email: 's@v.com', phone: null };
const client = { type: 'client', displayname: 'Accolade Screens', contact_id: null, client_id: 12, client_name: 'Accolade Screens', email: null, phone: '0390000000' };

describe('toPerson', () => {
    it('words the subtitle by row type', () => {
        expect(toPerson(contact).subtitle).toBe('Accolade Screens');
        expect(toPerson(general).subtitle).toBe('General contact');
        expect(toPerson(client).subtitle).toBe('Main line');
    });

    it('flags clients and keeps the client link', () => {
        expect(toPerson(client).isClient).toBe(true);
        expect(toPerson(contact).clientId).toBe(12);
        expect(toPerson(general).clientId).toBeNull();
    });

    it('uses the first name for contacts and the full name for clients', () => {
        expect(toPerson(contact).firstName).toBe('Pat');
        expect(toPerson(client).firstName).toBe('Accolade Screens');
    });
});

describe('sectionize', () => {
    it('groups by first letter, keeping API order', () => {
        const rows = [client, general, contact].sort((a, b) => a.displayname.localeCompare(b.displayname));
        const sections = sectionize(rows);

        expect(sections.map((s) => s.title)).toEqual(['A', 'P', 'V']);
        expect(sections[0].data[0].displayname).toBe('Accolade Screens');
    });

    it('puts non-letters under #', () => {
        expect(sectionize([{ displayname: '3M Support' }])[0].title).toBe('#');
    });
});

describe('recents', () => {
    it('keys by type and id', () => {
        expect(recentKey(contact)).toBe('client_contact-44');
        expect(recentKey(client)).toBe('client-12');
    });

    it('bumps to the front and caps at eight', () => {
        expect(bumpRecent(['a', 'b'], 'b')).toEqual(['b', 'a']);
        expect(bumpRecent(['1', '2', '3', '4', '5', '6', '7', '8'], '9')).toEqual(['9', '1', '2', '3', '4', '5', '6', '7']);
    });
});

describe('matches', () => {
    it('searches name, company, email and number', () => {
        expect(matches(contact, 'accolade')).toBe(true);
        expect(matches(contact, '0400')).toBe(true);
        expect(matches(general, 'accolade')).toBe(false);
    });
});
```

- [ ] **Step 2: Run, expect load failure**

- [ ] **Step 3: Implement the helpers**

`app/utils/addressBook.js`:

```js
// GET /api/address-book interleaves three row types. Everything the screen
// and the sheet need to know about a row is decided here, once.
export function toPerson(row) {
    const isClient = row?.type === 'client';
    const subtitle = isClient ? 'Main line' : (row?.client_name || 'General contact');

    return {
        key: recentKey(row),
        name: row?.displayname || '',
        subtitle,
        phone: row?.phone || null,
        email: row?.email || null,
        isClient,
        clientId: row?.client_id ?? null,
        clientName: row?.client_name || null,
        avatarId: row?.contact_id ?? row?.client_id ?? null,
        firstName: isClient ? (row?.displayname || '') : (row?.fname || row?.displayname || ''),
    };
}

export function recentKey(row) {
    return `${row?.type}-${row?.contact_id ?? row?.client_id}`;
}

export function bumpRecent(keys, key, max = 8) {
    return [key, ...(keys || []).filter((k) => k !== key)].slice(0, max);
}

const letterOf = (name) => {
    const first = String(name || '').trim().charAt(0).toUpperCase();

    return /[A-Z]/.test(first) ? first : '#';
};

// The API already sorts by displayname, so grouping keeps that order.
export function sectionize(rows) {
    const sections = [];

    (rows || []).forEach((row) => {
        const title = letterOf(row.displayname);
        const last = sections[sections.length - 1];

        if (last && last.title === title) last.data.push(row);
        else sections.push({ title, data: [row] });
    });

    return sections;
}

export function matches(row, term) {
    const haystack = `${row?.displayname || ''} ${row?.client_name || ''} ${row?.email || ''} ${row?.phone || ''}`;

    return haystack.toLowerCase().includes(String(term || '').toLowerCase());
}
```

`app/utils/recents.js` (keys only — never a name or number):

```js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bumpRecent } from './addressBook';

const KEY = 'addressBookRecents';

export async function loadRecents() {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
    } catch {
        return [];
    }
}

export async function rememberRecent(keys, key) {
    const next = bumpRecent(keys, key);

    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch { /* best effort */ }

    return next;
}
```

- [ ] **Step 4: Components**

`PersonRow` (padding `9 0`, gap 12, `alignItems: 'center'`, divider when `showDivider`): `Avatar uri={null} name={person.name} id={person.avatarId} size={40}` · identity (flex 1, gap 2): name row with name 15/700 truncate + `Client` badge (`primary+'1A'`, 10/700 primary, padding `2 7`, radius 999) when `person.isClient` · meta 12 textSecondary truncate `[person.subtitle, formatPhone(person.phone)].filter(Boolean).join(' · ')` · `IconButton icon="call-outline" label={'Call ' + person.name} disabled={!dialUri(person.phone)} onPress={() => Linking.openURL(dialUri(person.phone))}`. The row body is a `TouchableOpacity` calling `onPress`.

`ContactSheet`: `Modal transparent animationType="fade"`; backdrop `colors.overlay` closes on press; sheet at the bottom: `backgroundColor: colors.surface`, `borderTopLeftRadius: 20, borderTopRightRadius: 20`, `borderWidth: 1, borderColor: colors.border`, padding `14 18 44`, gap 14. Grabber 36×4 radius 2 `colors.border` centred. Header row gap 12: `Avatar` 56 · name 18/700 (+ Client badge) · subtitle 12 textSecondary. Action grid: `flexDirection: 'row', gap: 10`; four tiles each `flex: 1`, `borderWidth: 1, borderColor: colors.border, borderRadius: 14`, padding `12 4`, centred, Ionicon 22 primary + label 12/600 textPrimary; disabled tiles `opacity: 0.3` and inert:
  - Call `call-outline` → `Linking.openURL(dialUri(phone))`
  - SMS `chatbubble-outline` → `Linking.openURL(smsUri(phone))`
  - Email `mail-outline` → `Linking.openURL(mailUri(email))`
  - Copy `copy-outline` → `Clipboard.setStringAsync(formatPhone(phone))` then `onCopied('Number copied')`; disabled without a phone.
  Below: `LabelValue label="Phone" value={formatPhone(phone)}` and `LabelValue label="Email" value={email} last`. Then, when `person.clientId`: a `TouchableOpacity` row (padding `12 0`, gap 10, top divider) with `FontAwesome building-o` 16 primary + `Open {person.clientName || person.name}` 14/600 textPrimary + `chevron-forward` 18 textSecondary → `onClose()` then `router.push('/client/' + person.clientId)`.
  Call, SMS and Email also call `onUsed?.()` so the screen can bump recents; add `onUsed` to the props.

- [ ] **Step 5: Screen**

Rewrite `app/(main)/address-book.js`:

- Data: unchanged fetch. `recents` (keys) loaded once via `loadRecents()`. `sheetPerson` state (null = closed). `[toast, showToast] = useToast()`.
- Search: `term` as today; `visible = term ? rows.filter(r => matches(r, term)) : rows`.
- Not searching: `SectionList` with `sections={sectionize(rows)}`, `stickySectionHeadersEnabled`, `renderSectionHeader` = `SectionLabel` in a `View` with `backgroundColor: colors.background`, padding `8 0 4`. `ListHeaderComponent` = the Recent strip when `recents.length > 0`: `SectionLabel` "Recent" (paddingBottom 8) then a horizontal `ScrollView` (gap 14) of items `width: 60, alignItems: 'center', gap: 4`: `Avatar` 46 + `firstName` 11/600 textPrimary truncate; tap → open sheet. Resolve keys to rows with a `Map` from `recentKey(row)` → row; skip keys no longer present.
- Letter rail (only when not searching and there are ≥ 2 sections): `View` absolute `right: 2`, vertically centred (`top: 0, bottom: 0, justifyContent: 'center'`), one `TouchableOpacity` per section with letter 10/700 primary lineHeight 12 padding `0 6`; tap → `listRef.current.scrollToLocation({ sectionIndex, itemIndex: 0, animated: true })`. While the rail shows, the list gets `paddingRight: 30`.
- Searching: a `FlatList` of `visible` with `ListHeaderComponent` = `SectionLabel` `{visible.length} matches` (`1 match`), no rail, no recents; empty → `ScreenState emptyText="Nobody matches that"`.
- Rows: `PersonRow person={toPerson(item)} onPress={() => setSheetPerson(toPerson(item))} showDivider={index > 0}`.
- Sheet: `<ContactSheet person={sheetPerson} visible={!!sheetPerson} onClose={() => setSheetPerson(null)} onCopied={showToast} onUsed={() => rememberRecent(recents, sheetPerson.key).then(setRecents)} />`. Opening the sheet from a row also bumps recents.
- `<Toast message={toast} />` last inside the screen `View`.

- [ ] **Step 6: Verify and commit**

Parse-check `app/components/PersonRow.js app/components/ContactSheet.js "app/(main)/address-book.js" app/utils/recents.js`; `npx vitest run`.

```bash
git add "app/(main)/address-book.js" app/components/PersonRow.js app/components/ContactSheet.js app/utils/addressBook.js app/utils/recents.js tests/addressBook.test.js
git commit -m "feat: sectioned address book with recents, letter rail and a contact sheet"
```

---

### Task 7: Client detail (§8) — after Task 6

**Files:**
- Modify: `app/client/[id].js`
- Modify: `app/components/client/GeneralTab.js`
- Modify: `app/components/client/ContactsTab.js`
- Modify: `app/components/client/TicketsTab.js` (add `onCount` only)
- Modify: `app/components/client/AssetsTab.js` (add `onCount` only)

**Interfaces:**
- Consumes: `Avatar`, `IconButton`, `PersonRow`, `ContactSheet`, `Toast`/`useToast` (Tasks 1, 6), `addressLine`, `mapsUri`, `dialUri`, `mailUri`, `formatPhone`, `LabelValue`, `Card`/`CardHeader`.
- Client fields: `name, logo, phone, email, website, status, timezone, asset_prefix, xero_reference, primary_site { sitename, address { … } }, open_tickets`. Contact fields: `id, name, fname, sname, position, phone, email, photo, default_contact`.
- Produces: each tab accepts `onCount(n)` and calls it once its list has loaded (`ContactsTab`, `TicketsTab` with the current filter's `rows.length`, `AssetsTab`). `GeneralTab({ client, contacts, onShowContacts })`.

- [ ] **Step 1: Identity block and actions in `app/client/[id].js`**

Identity block padding `16 16 12`, gap 12: `Avatar uri={client.logo} name={client.name} id={client.id} size={46}` · name 17/700 · meta 12 textSecondary `[sitename, suburbcity, open_tickets > 0 ? '{n} open tickets' : null].filter(Boolean).join(' · ')`. Below, a row of up to three equal buttons (`flexDirection: 'row', gap: 8`; each `flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 9, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6`; Ionicon 15 primary + label 13/600 textPrimary): Call (`dialUri(client.phone)`), Email (`mailUri(client.email)`), Directions (`navigate-outline`, `mapsUri(addressLine(client.primary_site?.address))`). **Hide** a button whose URI is null.

Tab bar: keep as is, but after each label render a count `Text` 11/700 in the tab's own colour for `contacts`, `tickets`, `assets` when `counts[tab.id]` is a number. Keep `counts` state `{}`; pass `onCount={(n) => setCounts(c => ({ ...c, [id]: n }))}` to those tabs. Pass `onShowContacts={() => setActive('contacts')}` and the loaded contacts to `GeneralTab` — load contacts once in the page (`api.clientContacts(id)`, errors ignored) so the General tab can show the primary contact without the Contacts tab mounting; pass the same array to `ContactsTab` as `initialRows` to avoid a second fetch.

- [ ] **Step 2: General tab**

Card order **Site → Primary contact → Account**:
- Site: `CardHeader title="Site" meta={sitename}`; `LabelValue label="Address" value={addressLine(address)} uri={mapsUri(addressLine(address))}`, Phone (`formatPhone`/`dialUri`), Website (`last`).
- Primary contact: `CardHeader` custom children: title "Primary contact" + right `TouchableOpacity` "All contacts" 13/600 primary → `onShowContacts()`. Body padding `0 16`: `PersonRow person={{ key: 'primary', name, subtitle: position, phone, email, isClient: false, clientId: null, clientName: null, avatarId: contact.id, firstName: fname }} onPress={…open the same ContactSheet…}` for `contacts.find(c => c.default_contact)`; hide the card when there is none.
- Account: Status, Asset prefix, Xero ref, Timezone (`last`).

- [ ] **Step 3: Contacts tab**

Replace `ContactRow` with `PersonRow` (map each contact to a `Person` as in Step 2, `subtitle = position`, badge `Primary` shown by passing `badge` — add an optional `badge` prop to `PersonRow` that overrides the `Client` badge text) and open `ContactSheet` on tap, with `Toast` for copies. Call `onCount(rows.length)` after load.

- [ ] **Step 4: Verify and commit**

Parse-check all five files; `npx vitest run`.

```bash
git add "app/client/[id].js" app/components/client/GeneralTab.js app/components/client/ContactsTab.js app/components/client/TicketsTab.js app/components/client/AssetsTab.js
git commit -m "feat: client page with actions, tab counts and a primary contact"
```

---

### Task 8: Asset Onboarding list (§6)

**Files:**
- Modify: `app/(main)/onboarding.js`
- Create: `app/utils/onboarding.js`
- Test: `tests/onboarding.test.js`

**Interfaces:**
- Consumes: `Card`/`CardHeader`, `SectionLabel`, `shortDate`.
- Produces `groupByClient(rows)` → `[{ client: string, items: Row[] }]` in first-seen order; `machineMeta(row)` → `"was {prev} · {shortDate(created_at)}"` with the `was` part omitted when `prev_computername` is null.

- [ ] **Step 1: Failing test**

`tests/onboarding.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { groupByClient, machineMeta } from '../app/utils/onboarding.js';

describe('groupByClient', () => {
    it('groups stably in first-seen order', () => {
        const rows = [
            { id: 1, client_name: 'Accolade Screens' },
            { id: 2, client_name: 'Drainpro' },
            { id: 3, client_name: 'Accolade Screens' },
        ];

        expect(groupByClient(rows).map((g) => [g.client, g.items.map((r) => r.id)]))
            .toEqual([['Accolade Screens', [1, 3]], ['Drainpro', [2]]]);
    });

    it('labels a missing client', () => {
        expect(groupByClient([{ id: 1 }])[0].client).toBe('No client');
    });
});

describe('machineMeta', () => {
    it('mentions the old name when there was one', () => {
        expect(machineMeta({ prev_computername: 'OLD-PC', created_at: '2026-08-15' })).toBe('was OLD-PC · 15 Aug 2026');
        expect(machineMeta({ prev_computername: null, created_at: '2026-08-15' })).toBe('15 Aug 2026');
    });
});
```

- [ ] **Step 2: Run, expect load failure**

- [ ] **Step 3: Implement**

`app/utils/onboarding.js`:

```js
import { shortDate } from './datetime';

export function groupByClient(rows) {
    const groups = [];
    const index = new Map();

    (rows || []).forEach((row) => {
        const client = row?.client_name || 'No client';

        if (!index.has(client)) {
            index.set(client, groups.length);
            groups.push({ client, items: [] });
        }

        groups[index.get(client)].items.push(row);
    });

    return groups;
}

export function machineMeta(row) {
    return [
        row?.prev_computername ? `was ${row.prev_computername}` : null,
        shortDate(row?.created_at),
    ].filter(Boolean).join(' · ');
}
```

- [ ] **Step 4: Screen**

Search placeholder "Computer, old name or client". One `Card`: `CardHeader title="Machines" meta={visible.length}`. For each group from `groupByClient(visible)`: a label row (`SectionLabel` `{group.client}`, padding `10 16 4`, top divider except for the first group), then rows (`TouchableOpacity`, padding `10 16`, gap 12, `alignItems: 'center'`): 40 circle `primary+'1A'` with `laptop-outline` 18 primary · copy: computername 15/700 monospace (`fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'`, letterSpacing 0.2) · `machineMeta(item)` 12 textSecondary truncate · `chevron-forward` 18 textSecondary. Use the single-synthetic-item FlatList pattern; keep refresh and empty state.

- [ ] **Step 5: Verify and commit**

```bash
git add "app/(main)/onboarding.js" app/utils/onboarding.js tests/onboarding.test.js
git commit -m "feat: group onboarded machines by client in one card"
```

---

### Task 9: Onboarding detail (§7, password rule applied)

**Files:**
- Modify: `app/onboarding/[id].js`

**Interfaces:**
- Consumes: `RevealField` (its `large` variant; it already re-masks when the app leaves the foreground and never offers copy), `IconButton`, `Toast`/`useToast`, `expo-clipboard`, `LabelValue`, `Card`/`CardHeader`.
- Record fields: `computername, prev_computername, client_name, label_code, created_at, username, localadmin_pw`.

- [ ] **Step 1: Reorder and restyle**

Card order **Local administrator → Machine**.

Local administrator: `CardHeader title="Local administrator" meta={'Label ' + (record.label_code || '—')}`. Body padding `14 16 16`, gap 14:
- Username block: label "USERNAME" (11/700 uppercase, letterSpacing 0.4, textSecondary) · row: value 18/700 monospace textPrimary (`record.username || 'localadmin'`) + `IconButton icon="copy-outline" size={16} label="Copy username"` → `Clipboard.setStringAsync(username)` then toast "Username copied".
- Password block: label "PASSWORD" · a container `borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 14, backgroundColor: colors.inputBackground` holding `<RevealField label="Password" value={record.localadmin_pw ?? '—'} large />` — pass a new `hideLabel` prop to `RevealField`? **No: do not modify `RevealField`.** Instead render the field's own label as the block label and pass `label="Password"` (it is the accessibility name of the eye button); its inner label row is small and acceptable. **There is no copy button for the password.** Hint line 11 textSecondary under the container: "Tap the eye to reveal. Never shown by default. Hides again when you leave this screen."

Machine card: `LabelValue` Client, Computer (monospace value: pass the value through `LabelValue` as-is; monospace is not required here), Was, Deployed (`shortDate`, `last`). Footnote unchanged. `<Toast message={toast} />` inside the `SafeAreaView`.

- [ ] **Step 2: Verify and commit**

```bash
git add "app/onboarding/[id].js"
git commit -m "feat: lead the deployment page with the local administrator"
```

---

### Task 10: Auth screens (§9)

**Files:**
- Modify: `app/(auth)/login.js`
- Modify: `app/(auth)/otp.js`
- Modify: `app/(auth)/vpn.js`
- Create: `app/utils/otp.js`
- Test: `tests/otp.test.js`

**Interfaces:**
- Consumes: `t` from `app/constants/authTheme.js` (fixed palette), `api.ipCheck()`, `api.checkOtp`, `persistAuth`, `Linking.openSettings()`.
- Produces `sanitizeOtp(text)` → digits only, max 6; `isCompleteOtp(code)` → `code.length === 6`.

- [ ] **Step 1: Failing test**

`tests/otp.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { sanitizeOtp, isCompleteOtp } from '../app/utils/otp.js';

describe('sanitizeOtp', () => {
    it('keeps digits only and caps at six', () => {
        expect(sanitizeOtp('12 34-56 78')).toBe('123456');
        expect(sanitizeOtp('abc1')).toBe('1');
        expect(sanitizeOtp(null)).toBe('');
    });
});

describe('isCompleteOtp', () => {
    it('is true at six digits', () => {
        expect(isCompleteOtp('123456')).toBe(true);
        expect(isCompleteOtp('12345')).toBe(false);
    });
});
```

- [ ] **Step 2: Run, expect load failure**

- [ ] **Step 3: Implement**

`app/utils/otp.js`:

```js
export function sanitizeOtp(text) {
    return String(text || '').replace(/\D/g, '').slice(0, 6);
}

export function isCompleteOtp(code) {
    return sanitizeOtp(code).length === 6;
}
```

- [ ] **Step 4: Login**

Password input gets a trailing `TouchableOpacity` with `eye-outline` / `eye-off-outline` 18 `t.textSecondary` toggling a `showPassword` state → `secureTextEntry={!showPassword}` (wrap the input in a row `View` with the existing input styles). Replace the "Requires the office VPN" footnote with a centred row (gap 6): `shield-checkmark-outline` 14 `#28C76F` + "Office VPN connected" 12 `t.textSecondary`.

- [ ] **Step 5: OTP**

Title "Enter your code"; subtitle `Sent by text to {maskedMFA}. It verifies as soon as all six digits are in.` (for `mfaType === 'email'` say "Sent by email to"; for `totp` say "From your authenticator app."). Replace the visible input with six boxes in a row (`gap: 8`; each `flex: 1, height: 56, borderRadius: 12, backgroundColor: t.inputBackground, borderWidth: 1, borderColor: t.border`, the active box, index `code.length` clamped to 5, gets `borderColor: t.accent`; digit 26/700 `t.textPrimary` centred). Keep one hidden `TextInput` (`position: 'absolute', opacity: 0, height: 1, width: 1`) with `textContentType="oneTimeCode"`, `keyboardType="number-pad"`, `maxLength={6}`, `autoFocus`, `value={code}`, `onChangeText={(v) => setCode(sanitizeOtp(v))}`; tapping the boxes focuses it. When `isCompleteOtp(code)` becomes true, call `submit()` once (effect on `code`). Verify button stays. Method switch label: "Didn't get it? Use a different method".

- [ ] **Step 6: VPN gate**

Body copy: "The staff app only works from the office network. Turn the VPN on — we'll notice and sign you in." While mounted, re-run `recheck` every 5 s: keep `seconds` state counting down from 5 in a 1 s interval, call `recheck()` at 0 and reset; show a small `ActivityIndicator` + `Checking again in {seconds}s` 12 `t.textSecondary` (while a check is running show "Checking…"). Button label "Try now". Below it a text link "Open VPN settings" 13/600 `t.accent` → `Linking.openSettings()`. Clear the interval on unmount and stop the loop once `allowed` routes away.

- [ ] **Step 7: Verify and commit**

Parse-check the three screens; `npx vitest run`.

```bash
git add "app/(auth)/login.js" "app/(auth)/otp.js" "app/(auth)/vpn.js" app/utils/otp.js tests/otp.test.js
git commit -m "feat: six-box OTP, password eye and a self-checking VPN gate"
```

---

### Task 11: Docs and final verification (run by the coordinator)

**Files:**
- Modify: `README.md`

- [ ] Add a short "Screens" note to the README pointing at the handoff plan (`docs/superpowers/plans/2026-09-06-ux-redesign.md`) and stating the two deliberate deviations: no password copy button; ticket age kept.
- [ ] Run `npx vitest run` (all green) and the esbuild parse-check over every `app/**/*.js` file: `find app -name '*.js' | xargs npx esbuild --loader:.js=jsx --log-level=warning --outdir=/tmp/esb-all >/dev/null`.
- [ ] `grep -rn "ContactRow" app` — expect only its own file; delete `app/components/ContactRow.js` if nothing imports it.
- [ ] Commit `docs: note the redesign plan and its deviations`.

## Self-review

- **Spec coverage:** §1 Task 6; §2 Task 4; §3 Task 5; §4 Task 2; §5 Task 3; §6 Task 8; §7 Task 9; §8 Task 7; §9 Task 10. Global rules → Task 1 primitives and Global Constraints. Toast → Task 1, used in 6, 7, 9. Recents → Task 6. Password re-mask → already in `RevealField`.
- **Deviations from spec, deliberate:** no password copy button (owner instruction); ticket age kept; `RevealField` unchanged.
- **Type consistency:** `Person` shape is defined once in Task 6 and used verbatim in Task 7. `IconButton` props are the same in Tasks 3, 5, 6, 7, 9. `TicketRow` props after Task 2 are `ticket, index, showClient`; Task 4 and the client `TicketsTab` pass only those.
