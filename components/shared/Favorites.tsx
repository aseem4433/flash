import React, { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import Image from "next/image";
import { creatorUser } from "@/types";
import * as Sentry from "@sentry/nextjs";

interface FavoriteItem {
	creatorId: creatorUser;
}

const Favorites = ({
	setMarkedFavorite,
	markedFavorite,
	handleToggleFavorite,
	addingFavorite,
	creator,
	user,
	isCreatorOrExpertPath,
	isFavoritesPath,
}: {
	setMarkedFavorite: React.Dispatch<React.SetStateAction<boolean>>;
	markedFavorite: boolean;
	handleToggleFavorite: () => Promise<void>;
	addingFavorite: boolean;
	creator: creatorUser;
	user: any;
	isCreatorOrExpertPath?: boolean;
	isFavoritesPath?: boolean;
}) => {
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchFavorites = async () => {
			try {
				const response = await fetch("/api/v1/favorites/getFavorites", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						clientId: user?._id,
					}),
				});

				if (response.ok) {
					const data = await response.json();
					const favorites: FavoriteItem[] = data.favorites;

					// Check if the current creator is in the favorites
					const isFavorite = favorites.some(
						(fav) => fav.creatorId._id === creator._id
					);
					setMarkedFavorite(isFavorite);
				} else {
					console.error("Failed to fetch favorites");
				}
			} catch (error) {
				Sentry.captureException(error);
				console.error("Error fetching favorites:", error);
			} finally {
				setLoading(false);
			}
		};

		if (user?._id && (isCreatorOrExpertPath || isFavoritesPath)) {
			fetchFavorites();
		}
	}, [user, creator._id]);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					className={`${
						isFavoritesPath ? "p-2 rounded-full" : "p-3 rounded-xl"
					}  transition-all duration-300  hover:scale-105 group ${
						markedFavorite ? "bg-green-1" : "bg-[#232323]/35"
					} hover:bg-green-1 flex gap-2 items-center`}
					onClick={handleToggleFavorite}
				>
					{!addingFavorite || !loading ? (
						!markedFavorite ? (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={1.5}
								stroke="currentColor"
								className={`${isFavoritesPath ? "size-4" : "size-6"} invert`}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
								/>
							</svg>
						) : (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={1.5}
								stroke="currentColor"
								className={`${isFavoritesPath ? "size-4" : "size-6"} invert`}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="m3 3 1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17.25 4.5 21V8.742m.164-4.078a2.15 2.15 0 0 1 1.743-1.342 48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185V19.5M4.664 4.664 19.5 19.5"
								/>
							</svg>
						)
					) : (
						<Image
							src="/icons/loading-circle.svg"
							alt="Loading..."
							width={1000}
							height={1000}
							className={`${isFavoritesPath ? "size-4" : "size-6"} `}
							priority
						/>
					)}
				</button>
			</TooltipTrigger>
			<TooltipContent className="bg-green-1 border-none text-white">
				<p>{`${
					markedFavorite ? "Remove as Favorite" : "Add to Favorites"
				} `}</p>
			</TooltipContent>
		</Tooltip>
	);
};

export default Favorites;
