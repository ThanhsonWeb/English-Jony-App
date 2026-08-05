"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import AuthButtons from "./AuthButtons";

const navLinks = [
   { name: "Home", href: "/" },
   { name: "Dictation", href: "/dictation" },
   { name: "Speaking", href: "/speaking" },
   { name: "Vocabulary", href: "/vocabulary" },
];

function Navigation() {
   const pathname = usePathname();
   const [isOpen, setIsOpen] = useState(false);

   return (
      <nav>
         {/* Desktop Navigation */}
         <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
               const isActive =
                  link.href === "/"
                     ? pathname === "/"
                     : pathname.startsWith(link.href);

               return (
                  <li key={link.name}>
                     <Link
                        href={link.href}
                        className={`text-lg font-medium hover:text-blue-400 transition-colors ${
                           isActive
                              ? "text-blue-400 font-semibold"
                              : "text-slate-300"
                        }`}
                     >
                        {link.name}
                     </Link>
                  </li>
               );
            })}
         </ul>

         {/* Mobile Menu Button */}
         <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-slate-300 hover:text-white p-2"
            aria-label="Toggle menu"
         >
            {isOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
         </button>

         {/* Mobile Dropdown Menu */}
         {isOpen && (
            <div className="absolute top-full left-0 w-full bg-slate-900 border-b border-slate-800 p-6 flex flex-col gap-4 md:hidden z-50">
               {navLinks.map((link) => {
                  const isActive =
                     link.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(link.href);

                  return (
                     <Link
                        key={link.name}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className={`text-lg font-medium hover:text-blue-400 transition-colors ${
                           isActive
                              ? "text-blue-400 font-semibold"
                              : "text-slate-300"
                        }`}
                     >
                        {link.name}
                     </Link>
                  );
               })}

               {/* Add Auth Buttons inside mobile dropdown 🔑 */}
               <div className="pt-4 border-t border-slate-800 flex flex-col gap-3 sm:hidden ">
                  <AuthButtons />
               </div>
            </div>
         )}
      </nav>
   );
}

export default Navigation;