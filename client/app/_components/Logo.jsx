import { Link } from "@/i18n/navigation";
import Image from "next/image";

function Logo({ wordlistMobile = false }) {
	return (
		<Link href="/" className="z-10 flex shrink-0 items-center gap-2 xl:gap-3">
			<Image
				src="/jony.png"
				height={48}
				width={48}
				quality={75}
				priority
				alt="English-Jony logo"
				className={`h-10 w-10 rounded-xl sm:h-12 sm:w-12${wordlistMobile ? " max-md:h-[50px] max-md:w-[57px] max-md:object-contain" : ""}`}
			/>
			<span className="hidden whitespace-nowrap text-lg uppercase tracking-wide text-main sm:inline sm:text-xl xl:text-2xl">
				<span>StudyJony</span>
			</span>
		</Link>
	);
}

export default Logo;
