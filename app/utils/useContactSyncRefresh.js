import { useEffect } from 'react';
import { AppState } from 'react-native';
import { refreshIfStale } from './contactSync';

// WorkManager keeps the directory roughly hourly in the background. Coming to
// the foreground is the cheap moment to catch up if Android deferred it.
export default function useContactSyncRefresh(active) {
    useEffect(() => {
        if (!active) return undefined;

        refreshIfStale();

        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') refreshIfStale();
        });

        return () => subscription.remove();
    }, [active]);
}
