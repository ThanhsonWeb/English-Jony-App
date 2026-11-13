import Header from "@/app/_components/Header";
import MiniDictionary from "@/app/_components/MiniDictionary";
import { DialogueProgressNotice } from "@/app/_components/DialogueProgressSave";

export default function MainLayout({ children }) {
	return (
		<div className="min-h-screen bg-page text-main">
			<Header />
			<DialogueProgressNotice />
			{children}
			<MiniDictionary />
		</div>
	);
}
