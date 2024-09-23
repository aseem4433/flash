"use client";

import {
	ReactNode,
	createContext,
	useContext,
	useEffect,
	useState,
	useMemo,
} from "react";
import Cookies from "js-cookie";
import { getCookie } from "cookies-next";

import { clientUser, creatorUser } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import axios from "axios";
import { deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

// Define the shape of the context value
interface CurrentUsersContextValue {
	clientUser: clientUser | null;
	creatorUser: creatorUser | null;
	currentUser: clientUser | creatorUser | null;
	setClientUser: (user: clientUser | null) => void;
	setCreatorUser: (user: creatorUser | null) => void;
	userType: string | null;
	refreshCurrentUser: () => Promise<void>;
	handleSignout: () => void;
	currentTheme: string;
	setCurrentTheme: any;
	authenticationSheetOpen: boolean;
	setAuthenticationSheetOpen: any;
	fetchingUser: boolean;
}

// Create the context with a default value of null
const CurrentUsersContext = createContext<CurrentUsersContextValue | null>(
	null
);

// Custom hook to use the CurrentUsersContext
export const useCurrentUsersContext = () => {
	const context = useContext(CurrentUsersContext);
	if (!context) {
		throw new Error(
			"useCurrentUsersContext must be used within a CurrentUsersProvider"
		);
	}
	return context;
};

// Utility function to check if we're in the browser
const isBrowser = () => typeof window !== "undefined";

// Provider component to hold the state and provide it to its children
export const CurrentUsersProvider = ({ children }: { children: ReactNode }) => {
	const [clientUser, setClientUser] = useState<clientUser | null>(null);
	const [creatorUser, setCreatorUser] = useState<creatorUser | null>(null);
	const [currentTheme, setCurrentTheme] = useState("");
	const [authenticationSheetOpen, setAuthenticationSheetOpen] = useState(false);
	const [fetchingUser, setFetchingUser] = useState(false);
	const [userType, setUserType] = useState<string | null>(null);
	const [authToken, setAuthToken] = useState<string | null>(null);

	const { toast } = useToast();
	const router = useRouter();

	// Define the unified currentUser state
	const currentUser = useMemo(
		() => creatorUser || clientUser,
		[creatorUser, clientUser]
	);

	useEffect(() => {
		if (isBrowser()) {
			const storedUserType = localStorage.getItem("userType");
			if (storedUserType) {
				setUserType(storedUserType);
			} else {
				setUserType(currentUser?.profession ? "creator" : "client");
			}
		}
	}, [currentUser?._id]);

	// Function to handle user signout
	const handleSignout = () => {
		const phone = currentUser?.phone; // Store phone number before resetting the state
		if (phone) {
			const userAuthRef = doc(db, "authToken", phone);

			// Remove the session from Firestore
			deleteDoc(userAuthRef)
				.then(() => {
					console.log("Document successfully deleted!");
				})
				.catch((error: any) => {
					Sentry.captureException(error);
					console.error("Error removing document: ", error);
				});
		}

		// Clear user data and local storage
		if (isBrowser()) {
			localStorage.removeItem("currentUserID");
			localStorage.removeItem("authToken");
			localStorage.removeItem("creatorURL");
			localStorage.removeItem("notifyList");
			// Clear the cookie
			Cookies.remove("authToken");
		}
		setClientUser(null);
		setCreatorUser(null);
	};

	// Function to fetch the current user
	const fetchCurrentUser = async () => {
		try {
			setFetchingUser(true);
			// Call the backend endpoint to get the profile data

			const response = await axios.get(
				`${process.env.NEXT_PUBLIC_BASE_URL_BACKEND}/user/getProfile`,
				{
					withCredentials: true, // Ensure cookies are sent with the request
				}
			);

			console.log(response.data);
			const { success, data, token } = response.data;

			if (success && data) {
				if (data.userType === "creator") {
					setCreatorUser(data);
					setClientUser(null);
					setUserType("creator");
				} else {
					setClientUser(data);
					setCreatorUser(null);
					setUserType("client");
				}
				setAuthToken(token);
				localStorage.setItem("userType", data.userType);
			} else {
				handleSignout();
			}
		} catch (error) {
			console.error("Error fetching current user:", error);
			handleSignout();
		} finally {
			setFetchingUser(false);
		}
	};

	// Call fetchCurrentUser when the component mounts
	useEffect(() => {
		// Fetch current user on mount
		fetchCurrentUser();
	}, []);

	// Function to refresh the current user data
	const refreshCurrentUser = async () => {
		await fetchCurrentUser();
	};

	// Redirect to /updateDetails if username is missing
	useEffect(() => {
		if (currentUser && userType === "creator" && !currentUser.username) {
			router.replace("/updateDetails");
			setTimeout(() => {
				toast({
					variant: "destructive",
					title: "Greetings Friend",
					description: "Complete Your Profile Details...",
				});
			}, 1000);
		}
	}, [router, userType]);

	// real-time session monitoring
	useEffect(() => {
		if (!currentUser || !currentUser.phone) {
			return;
		}

		const userAuthRef = doc(db, "authToken", currentUser.phone);

		const unsubscribe = onSnapshot(
			userAuthRef,
			(doc) => {
				try {
					if (doc.exists()) {
						const data = doc.data();
						if (isBrowser()) {
							if (data?.token && data.token !== authToken) {
								handleSignout();
								toast({
									variant: "destructive",
									title: "Another Session Detected",
									description: "Logging Out...",
								});
							}
						}
					}
				} catch (error) {
					Sentry.captureException(error);
					console.error("Error processing the document: ", error);
				}
			},
			(error) => {
				console.error("Error fetching document: ", error);
			}
		);

		// Cleanup function to clear heartbeat and update status to "Offline"
		return () => {
			unsubscribe();
		};
	}, [currentUser?.phone]);

	// Provide the context value to children
	return (
		<CurrentUsersContext.Provider
			value={{
				clientUser,
				creatorUser,
				currentUser,
				setClientUser,
				setCreatorUser,
				userType,
				refreshCurrentUser,
				handleSignout,
				currentTheme,
				setCurrentTheme,
				authenticationSheetOpen,
				setAuthenticationSheetOpen,
				fetchingUser,
			}}
		>
			{children}
		</CurrentUsersContext.Provider>
	);
};
