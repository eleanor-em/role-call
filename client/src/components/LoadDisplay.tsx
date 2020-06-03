import * as React from 'react';
import '../css/App.css';
import { useState, useEffect } from 'react';

export const LoadDisplay = function(): React.ReactElement {
    const [dotCount, setDotCount] = useState(1);

    // animate the dot
    useEffect(() => {
        let count = dotCount;
        const interval = setInterval(() => {
            count = count % 3 + 1;
            setDotCount(count);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const msg = 'loading' + '.'.repeat(dotCount);

    return (
        <div className="Content">
            {msg}
        </div>
    );
};