// Next Image import
import Image from 'next/image';

import Menu from './Menu';
import { useState, useEffect } from 'react';

export default function Header() {

    return (
        <header className="flex items-center justify-between bg-neutral-800 p-4 shadow-md rounded-lg mb-4">
            
            <Menu />

            {/* Title */}
            <h1 className="text-2xl font-light text-white flex items-center gap-2">                
                <Image src="/logo.png" alt="Logo" width={130} height={50} />
            </h1>

        </header>
    );
}