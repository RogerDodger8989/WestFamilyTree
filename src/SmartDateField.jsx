import React, { useState, useEffect } from 'react';
import { parseDateString } from './dateParser.js';

export default function SmartDateField({ value, onChange, placeholder, className }) {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        setDisplayValue(value);
    }, [value]);

    const handleBlur = () => {
        const parsed = parseDateString(displayValue);
        onChange(parsed);
    };

    const baseClass = className ? className : 'w-full p-2 border border-slate-600 bg-slate-900 text-slate-200 rounded';
    const combinedClass = `${baseClass} focus:border-blue-500 focus:outline-none`;

    return (
        <input
            type="text"
            className={combinedClass}
            value={displayValue || ''}
            onChange={(e) => setDisplayValue(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
        />
    );
}