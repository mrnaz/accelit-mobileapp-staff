import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Theme from '../../context/ThemeContext';
import Card, { cardGap, CardHeader, cardBodyPadding } from '../Card';
import LabelValue from '../LabelValue';
import PersonRow from '../PersonRow';
import ContactSheet from '../ContactSheet';
import { contactPerson } from './ContactsTab';
import { addressLine } from '../../utils/address';
import { mapsUri } from '../../utils/maps';
import { dialUri, formatPhone } from '../../utils/phone';

// Key information only, in the order someone standing in a comms room wants
// it: where the site is, who to ring there, then the account trivia. The web
// Details tab also carries contracts, projects, tags, happiness and CRM stage —
// none of which helps on site, and contracts/projects are always null for a
// non-sysadmin anyway.
//
// `contacts` is the list the client page already fetched, so the primary
// contact shows up here without the Contacts tab ever mounting. It arrives
// only at an access level allowed to see contacts at all — no array means no
// primary contact card — and the switch to the full list appears only when the
// page offers somewhere to switch to.
export default function GeneralTab({ client, contacts, onShowContacts }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [sheetPerson, setSheetPerson] = useState(null);

    const site = client?.primary_site;
    const address = addressLine(site?.address);

    const primary = Array.isArray(contacts)
        ? contacts.find((contact) => contact.default_contact)
        : null;
    const primaryPerson = primary ? contactPerson(primary, 'primary') : null;

    return (
        <View style={styles.wrap}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Card>
                    <CardHeader title="Site" meta={site?.sitename || undefined} />
                    <View style={styles.inner}>
                        <LabelValue label="Address" value={address} uri={mapsUri(address)} />
                        <LabelValue
                            label="Phone"
                            value={formatPhone(client?.phone)}
                            uri={dialUri(client?.phone)}
                        />
                        <LabelValue
                            label="Website"
                            value={client?.website}
                            uri={client?.website ? String(client.website) : null}
                            last
                        />
                    </View>
                </Card>

                {primaryPerson ? (
                    <Card>
                        <CardHeader>
                            <Text
                                style={[styles.headerTitle, { color: colors.textPrimary }]}
                                numberOfLines={1}
                            >
                                Primary contact
                            </Text>
                            {onShowContacts ? (
                                <TouchableOpacity
                                    onPress={onShowContacts}
                                    accessibilityRole="button"
                                    accessibilityLabel="All contacts"
                                >
                                    <Text style={[styles.switch, { color: colors.primary }]}>
                                        All contacts
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </CardHeader>
                        <View style={styles.people}>
                            <PersonRow
                                person={primaryPerson}
                                onPress={() => setSheetPerson(primaryPerson)}
                            />
                        </View>
                    </Card>
                ) : null}

                <Card>
                    <CardHeader title="Account" />
                    <View style={styles.inner}>
                        <LabelValue label="Status" value={client?.status} />
                        <LabelValue label="Asset prefix" value={client?.asset_prefix} />
                        <LabelValue label="Xero ref" value={client?.xero_reference} />
                        <LabelValue label="Timezone" value={client?.timezone} last />
                    </View>
                </Card>
            </ScrollView>

            <ContactSheet
                person={sheetPerson}
                visible={!!sheetPerson}
                onClose={() => setSheetPerson(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1 },
    scroll: { padding: 16, gap: cardGap },
    inner: { ...cardBodyPadding },
    people: { paddingHorizontal: 16 },
    headerTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
    switch: { fontSize: 13, fontWeight: '600' },
});
