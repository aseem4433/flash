"use client";

import { formatDateTime } from "@/lib/utils";
import { SelectedChat } from "@/types";
import { useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import ContentLoading from "../shared/ContentLoading";
import Link from "next/link";
import Image from "next/image";
import FeedbackCheck from "../feedbacks/FeedbackCheck";

const ChatList = () => {
	const [chats, setChats] = useState<SelectedChat[]>([]);
	const [chatsCount, setChatsCount] = useState(8);
	const [loading, setLoading] = useState(true);
	const { user } = useUser();
	const pathname = usePathname();
	const router = useRouter();

	useEffect(() => {
		const handleScroll = () => {
			if (
				window.innerHeight + window.scrollY >=
				document.body.offsetHeight - 2
			) {
				setChatsCount((prevCount) => prevCount + 6);
			}
		};

		window.addEventListener("scroll", handleScroll);
		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	}, []);

	useEffect(() => {
		const getChats = async () => {
			try {
				const response = await fetch(
					`/api/v1/chats/getUserChats?userId=${String(
						user?.publicMetadata?.userId
					)}`
				);
				const data = await response.json();
				setChats(data);
			} catch (error) {
				console.warn(error);
			} finally {
				setLoading(false); // Set loading to false after data is fetched
			}
		};

		getChats();
	}, [user]);

	const visibleChats = chats.slice(0, chatsCount);

	const handleChatClick = (chat: SelectedChat) => {
		const chatData = encodeURIComponent(JSON.stringify(chat));
		router.push(`/chatDetails?selectedChat=${chatData}`); // Redirect to chat details page
	};

	if (loading) {
		return (
			<section className="w-full h-full flex items-center justify-center">
				<ContentLoading />
			</section>
		);
	}

	return (
		<>
			{chats && chats.length > 0 ? (
				<section
					className={`grid grid-cols-1 ${
						chats.length > 0 && "xl:grid-cols-2 3xl:grid-cols-3"
					} items-center gap-5 xl:gap-10 w-full h-fit text-black px-4 overflow-hidden`}
				>
					{visibleChats.map((chat, index) => {
						const formattedDate = formatDateTime(chat.startedAt as Date);
						return (
							<div
								key={index}
								className={`flex h-full w-full items-start justify-between pt-2 pb-4 xl:max-w-[568px] border-b xl:border xl:rounded-xl xl:p-4 xl:shadow-md border-gray-300 ${
									pathname.includes("/profile") && "mx-auto"
								}`}
							>
								<div
									className="flex flex-col items-start justify-start w-full gap-2"
									onClick={() => handleChatClick(chat)}
								>
									{/* Expert's Details */}
									<Link
										href={`/creator/${chat.members[0].user_id}`}
										className="w-1/2 flex items-center justify-start gap-4 hoverScaleDownEffect"
									>
										{/* creator image */}
										<Image
											src={chat.members[0].custom.image}
											alt="Expert"
											height={1000}
											width={1000}
											className="rounded-full w-12 h-12 object-cover"
										/>
										{/* creator details */}
										<div className="flex flex-col">
											<p className="text-base tracking-wide">
												{chat.members[0].custom.name}
											</p>
											<span className="text-sm text-green-1">Astrologer</span>
										</div>
									</Link>
								</div>
								{/* StartedAt & Feedbacks */}
								<div className="w-1/2 flex flex-col items-end justify-between h-full gap-2">
									<span className="text-sm text-[#A7A8A1] pr-1 pt-1 whitespace-nowrap">
										{formattedDate.dateTime}
									</span>
									{chat.status !== "Rejected" ? (
										<FeedbackCheck callId={chat?.chatId} />
									) : (
										<Link
											href={`/creator/${chat.members[0].user_id}`}
											className="animate-enterFromRight lg:animate-enterFromBottom bg-green-1 hover:bg-green-700 text-white font-semibold w-fit mr-1 rounded-md px-4 py-2 text-xs"
										>
											Visit Again
										</Link>
									)}
								</div>
							</div>
						);
					})}
				</section>
			) : (
				<div className="flex flex-col w-full items-center justify-center h-full gap-7">
					<ContentLoading />
					<h1 className="text-2xl font-semibold text-black">No Orders Yet</h1>
					<Link
						href="/"
						className={`flex gap-4 items-center p-4 rounded-lg justify-center bg-green-1 hover:opacity-80 mx-auto w-fit`}
					>
						<Image
							src="/icons/Home.svg"
							alt="Home"
							width={24}
							height={24}
							className="brightness-200"
						/>
						<p className="text-lg font-semibold text-white">Return Home</p>
					</Link>
				</div>
			)}
		</>
	);
};

export default ChatList;
