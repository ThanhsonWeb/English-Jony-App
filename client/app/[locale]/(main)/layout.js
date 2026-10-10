import Header from "@/app/_components/Header";
import MobileBottomNav from "@/app/_components/MobileBottomNav";
import MiniDictionary from "@/app/_components/MiniDictionary";
import styles from "@/app/_components/MainLayout.module.css";
import { DialogueProgressNotice } from "@/app/_components/DialogueProgressSave";

export default function MainLayout({ children }) {
	return (
		<div className={`${styles.layout} min-h-screen bg-page text-main`}>
			<Header />
			<DialogueProgressNotice />
			{children}
			<MiniDictionary />
			<MobileBottomNav />
		</div>
	);
}
