// Next Image import
import Image from 'next/image';

import Menu from './Menu';
import { FaStore } from 'react-icons/fa';

import { useStore } from '../context/StoreContext';

export default function Header() {

    // *** Use the store context ***
    const { availableStores, selectedStore, setSelectedStore } = useStore();
    
    // Handle store change
    const handleStoreChange = (event) => {
        setSelectedStore(event.target.value);
        // Optionally close the menu when store changes
        // toggleMenu();
    };


    return (
        <header className="flex items-center justify-between bg-neutral-800 p-4 shadow-md rounded-lg mb-4">
            
            <Menu />

            

            {/* Title */}
            <h1 className="text-2xl font-light text-white flex items-center gap-2">                
                <Image src="/logo.png" alt="Logo" width={130} height={50} />
                {/* Store Selector Dropdown */}
                <div className="flex items-center bg-neutral-700 rounded-lg px-2">
                    <FaStore className="text-neutral-400" />
                    <select
                        value={selectedStore}
                        onChange={handleStoreChange}
                        className="bg-transparent text-white py-1.5 pl-1 pr-6 appearance-none focus:outline-none cursor-pointer"
                        title="Select Active Store"
                    >
                        {availableStores.map(store => (
                            <option key={store} value={store} className="bg-neutral-800 text-white">
                                {store}
                            </option>
                        ))}
                    </select>
                </div>
            </h1>

        </header>
    );
}