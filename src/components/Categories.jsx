import {useEffect, useState} from 'react';
import * as XLSX from 'xlsx';
import './Categories.css';
import supabase from './config/supabaseClient';

const Categories = () => {
    //console.log(supabase)
    const [fetchError, setFetchError] = useState(null);
    const[items, setItems] = useState(null);

    useEffect(() => {
        const fetchItems = async () => {
            const { data, error } = await supabase
                .from('Spreadsheet Items')
                .select();

            if (error){
                setFetchError('Could not fetch data');
                setItems(null);
                console.log(error);
            }
            if (data){
                setItems(data);
                setFetchError(null);
            }
        };

        fetchItems();
        
    }, [])

    const [categories, setCategories] = useState([]);
    const [error, setError] = useState('');

    const upload = (e) => {
        const file = e.target.files[0];

        if (!file) return;
        
        const reader = new FileReader();

        reader.onload = async (evt) => {
            const data = new Uint8Array(evt.target.result);
            const excelWorkbook = XLSX.read(data, {type:'array'});
            const excelWorksheet = excelWorkbook.Sheets[excelWorkbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(excelWorksheet);
            
            // Normalize columns names so "CATEGORY", "Category", etc. are all treated the same and don't result in errors
            const normalize = jsonData.map(row => {
                const normalizedRow = {};
                // Loop through each key (column name) for each row
                Object.keys(row).forEach(key => {
                    // Remove whitespace from each column name and fully convert to lowercase, then assign as the new column name
                    normalizedRow[key.trim().toLowerCase()] = row[key];
                });
                return normalizedRow;
            });

            // Return error message if the normalized first row doesn't have a category column, no need to check other rows
            if (!normalize[0] || !normalize[0].hasOwnProperty('category')) {
                setError("No 'category' column");
                setCategories([]);
                return;
            }

            await Promise.all(
                normalize.map(async (row) => {
                    const category = row.category;
                    const item = row.item;
                    let price = parseFloat(row.price);

                    if (isNaN(price)) {
                        price = 0;
                    }

                    // Update Postgres database
                    const {error} = await supabase
                        .from("Spreadsheet Items")
                        .insert([{Item: item, Category: category, Price: price}])
                    
                    if (error) {
                        console.error("Insertion error: ", error)
                    }
                })  
            );

            const calculateTotals = normalize.reduce((acc, row) => {
                const category = row.category;
                const price = parseFloat(row.price);

                if (!category) return acc;

                if (!acc[category]) acc[category] = 0;
                if (!isNaN(price)) acc[category] += price;
                
                return acc;
            }, {})

            // Create an array of unique "category" values from the normalized Excel data
            /*
            const uniqueCategories = [
                ...new Set(normalize.map((row) => row.category).filter(Boolean)),
            ];
            */

            const result = Object.entries(calculateTotals).map(([category, total]) => ({category, total}));

            setCategories(result);
            setError('');
        };
        reader.readAsArrayBuffer(file);
    };
    /*
    return (
        <div className='p-6 max-w-xl mx-auto'>
            <h1 className='text-2xl font-bold mb-4'>Item Price Calculator</h1>
            <input
                type='file'
                accept='.xlsx, .xls'
                onChange={upload}
                className='mb-4'
            />
            {error && <p className='text-red-500 mb-4'>{error}</p>}
            
            <div className='grid grid-cols-2 gap-4'>
                {categories.map(({category, total}, index) => (
                    <p>{category}: ${total.toFixed(2)}</p>
                ))}
            </div>
        </div>
    );
    */

    return (
        <div>
            <h1 className='text-2xl font-bold mb-4'>Item Price Calculator</h1>
            
            <input
                type='file'
                accept='.xlsx, .xls'
                onChange={upload}
                className='mb-4'
            />

            {error && <p className='text-red-500 mb-4'>{error}</p>}
            
            <table className='page-center'>
                <tbody>
                    {categories.map(({ category, total }, index) => (
                    <tr key={index}>
                        <td style={{border: '2px solid aliceblue'}}>{category}</td>
                        <td style={{border: '2px solid aliceblue'}}>${total.toFixed(2)}</td>
                    </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Categories;