import Link from "next/link";
import Image from "next/image";

function Logo() {
   return (
      <Link href="/" className="flex items-center gap-3 z-10">
         <Image
            src="/lugo.png"
            height={48}
            width={48}
            quality={75}
            priority
            alt="English-Jony logo"
            className="rounded-xl border border-slate-800 w-10 h-10 sm:w-12 sm:h-12"
         />
         <span className="text-xl sm:text-2xl font-bold text-slate-100">
            English <span className="text-blue-500">Jony</span>
         </span>
      </Link>
   );
}

export default Logo;