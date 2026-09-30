import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import * as session from './services/session';
import { routeFor } from './utils/sessionRules';

export default function Index() {
    const [target, setTarget] = useState(null);

    useEffect(() => {
        (async () => {
            const status = await session.status();

            setTarget(routeFor({ status, inAuthGroup: false }) ?? '/(main)');
        })();
    }, []);

    if (!target) return null;

    return <Redirect href={target} />;
}
