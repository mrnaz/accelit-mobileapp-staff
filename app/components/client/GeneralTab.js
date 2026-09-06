import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Card, { cardGap, CardHeader, cardBodyPadding } from '../Card';
import LabelValue from '../LabelValue';
import { dialUri, mailUri, formatPhone } from '../../utils/phone';

// Key information only. The web Details tab also carries contracts, projects,
// tags, happiness and CRM stage — none of which helps someone standing in a
// comms room, and contracts/projects are always null for a non-sysadmin anyway.
export default function GeneralTab({ client }) {
    const site = client?.primary_site;
    const address = site?.address;

    const addressLine = address
        ? [address.address1, address.address2, address.suburbcity, address.state, address.postcode]
            .filter(Boolean).join(', ')
        : null;

    return (
        <ScrollView contentContainerStyle={styles.scroll}>
            <Card>
                <CardHeader title="Contact" />
                <View style={styles.inner}>
                    <LabelValue
                        label="Phone"
                        value={formatPhone(client?.phone)}
                        uri={dialUri(client?.phone)}
                    />
                    <LabelValue label="Email" value={client?.email} uri={mailUri(client?.email)} />
                    <LabelValue
                        label="Website"
                        value={client?.website}
                        uri={client?.website ? String(client.website) : null}
                        last
                    />
                </View>
            </Card>

            <Card>
                <CardHeader title="Site" meta={site?.sitename || undefined} />
                <View style={styles.inner}>
                    <LabelValue label="Address" value={addressLine} />
                    <LabelValue label="Timezone" value={client?.timezone} last />
                </View>
            </Card>

            <Card>
                <CardHeader title="Account" />
                <View style={styles.inner}>
                    <LabelValue label="Status" value={client?.status} />
                    <LabelValue label="Asset prefix" value={client?.asset_prefix} />
                    <LabelValue label="Xero ref" value={client?.xero_reference} last />
                </View>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 16, gap: cardGap },
    inner: { ...cardBodyPadding },
});
