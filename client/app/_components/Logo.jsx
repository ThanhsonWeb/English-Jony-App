import { Link } from "@/i18n/navigation";
import Image from "next/image";

function Logo({ wordlistMobile = false, mobileDrawer = false }) {
	return (
		<Link href="/" className={`z-10 flex shrink-0 items-center gap-2 xl:gap-3${mobileDrawer ? " xl:gap-2" : ""}`}>
			<Image
				src="/jony.png"
				height={48}
				width={48}
				quality={75}
				priority
				alt="English-Jony logo"
				className={`rounded-xl ${mobileDrawer ? "h-10 w-10" : "h-12 w-12 sm:h-12 sm:w-12"}${wordlistMobile ? " max-md:h-[50px] max-md:w-[57px] max-md:object-contain" : ""}`}
			/>
			<span className={`${mobileDrawer ? "text-base" : "hidden text-lg sm:inline sm:text-xl xl:text-2xl"} whitespace-nowrap uppercase tracking-wide text-main`}>
				<span>StudyJony</span>
			</span>
		</Link>
	);
}

export default Logo;
