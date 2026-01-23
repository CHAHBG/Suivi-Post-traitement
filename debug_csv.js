
const fs = require('fs');
const path = require('path');

// Mock Config/Utils
const UTILS = {
    // Parse CSV data correctly handling quotes (COPIED FROM CONFIG.JS)
    parseCSV: (csvText) => {
        try {
            if (!csvText || typeof csvText !== 'string') return [];

            csvText = csvText.replace(/^\uFEFF/, '');
            const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
            if (lines.length === 0) return [];

            const firstLine = lines[0];
            const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

            const parseLine = (text) => {
                const result = [];
                let curVal = '';
                let inQuote = false;

                for (let i = 0; i < text.length; i++) {
                    const char = text[i];

                    if (inQuote) {
                        if (char === '"') {
                            if (i + 1 < text.length && text[i + 1] === '"') {
                                curVal += '"';
                                i++;
                            } else {
                                inQuote = false;
                            }
                        } else {
                            curVal += char;
                        }
                    } else {
                        if (char === '"') {
                            inQuote = true;
                        } else if (char === delimiter) {
                            result.push(curVal);
                            curVal = '';
                        } else {
                            curVal += char;
                        }
                    }
                }
                result.push(curVal);
                return result;
            };

            const headers = parseLine(lines[0]).map(h => h.trim().replace(/^\uFEFF/, '').replace(/\u00A0/g, ' '));
            console.log('Headers:', headers);

            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const values = parseLine(lines[i]);
                if (values.every(v => v === undefined || v.trim() === '')) continue;

                const row = {};
                headers.forEach((header, index) => {
                    const raw = values[index] !== undefined ? values[index].trim() : '';
                    row[header] = raw;
                });
                data.push(row);
            }
            return data;
        } catch (err) {
            console.error('Error parsing CSV:', err);
            return [];
        }
    }
};

// Read CSV
const csvPath = '/Users/user/Desktop/Applications/Suivi-Post-traitement/deliverables.csv';
const csvContent = fs.readFileSync(csvPath, 'utf8');

// Parse
const data = UTILS.parseCSV(csvContent);

// Test Logic
let lastExpert = 'Non assigné';

console.log(`\nTesting Fill Down Logic on first 20 rows:`);

data.slice(0, 20).forEach((row, index) => {
    const originalExpert = row['Experts Princip'];

    if (originalExpert && originalExpert.trim() !== '') {
        lastExpert = originalExpert;
    }

    console.log(`Row ${index + 1} (${row['Livrable'] || 'sub'}): RawExpert='${originalExpert}' -> FilledExpert='${lastExpert}'`);
});

// Check Liv 3.1 specifically (around index 7-15)
const targetRow = data.find(r => r['Livrable'] === 'Liv. 3.1');
console.log('\nLiv 3.1 Row Data:', targetRow);
