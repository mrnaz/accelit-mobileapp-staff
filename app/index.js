import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import api from './services/api';

export default function Index() {
    const [target, setTarget] = useState(null);

    useEffect(() => {
        (async () => {
            const token = await api.restore();

            setTarget(token ? '/(main)' : '/(auth)/login');
        })();
    }, []);

    if (!target) return null;

    return <Redirect href={target} />;
}
