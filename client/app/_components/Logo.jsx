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
				className="h-10 w-10 rounded-xl border border-app sm:h-12 sm:w-12"
			/>
			<span className="hidden text-lg uppercase tracking-wide text-main sm:inline sm:text-xl md:text-2xl">
				<span>StudyJony</span>
			</span>
		</Link>
	);
}

export default Logo;
