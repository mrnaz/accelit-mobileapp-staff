import { useEffect, useState } from 'react';

// Server-side search endpoints get one request per settled term rather than one
// per keystroke. Local filters use it too, to keep typing smooth on long lists.
export default function useDebounced(value, ms = 300) {
    const [settled, setSettled] = useState(value);

    useEffect(() => {
        const id = setTimeout(() => setSettled(value), ms);

        return () => clearTimeout(id);
    }, [value, ms]);

    return settled;
}
