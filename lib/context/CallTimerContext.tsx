import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
} from "react";
import { useWalletBalanceContext } from "./WalletBalanceContext";
import { useToast } from "@/components/ui/use-toast";
import { useCallStateHooks } from "@stream-io/video-react-sdk";
import { creatorUser } from "@/types";

interface CallTimerContextProps {
	timeLeft: string;
	hasLowBalance: boolean;
	pauseTimer: () => void;
	resumeTimer: () => void;
	anyModalOpen: boolean;
	setAnyModalOpen: (isOpen: boolean) => void;
	totalTimeUtilized: number;
}

interface CallTimerProviderProps {
	children: ReactNode;
	isVideoCall: boolean;
	isMeetingOwner: boolean;
	expert: any;
}

const CallTimerContext = createContext<CallTimerContextProps | null>(null);

export const useCallTimerContext = () => {
	const context = useContext(CallTimerContext);
	if (!context) {
		throw new Error(
			"useCallTimerContext must be used within a CallTimerProvider"
		);
	}
	return context;
};

const formatTimeLeft = (timeLeft: number): string => {
	const minutes = Math.floor(timeLeft);
	const seconds = Math.floor((timeLeft - minutes) * 60);
	const paddedMinutes = minutes.toString().padStart(2, "0");
	const paddedSeconds = seconds.toString().padStart(2, "0");
	return `${paddedMinutes}:${paddedSeconds}`;
};

export const CallTimerProvider = ({
	children,
	isVideoCall,
	isMeetingOwner,
}: CallTimerProviderProps) => {
	const { toast } = useToast();
	const [audioRatePerMinute, setAudioRatePerMinute] = useState(0);
	const [videoRatePerMinute, setVideoRatePerMinute] = useState(0);
	const [anyModalOpen, setAnyModalOpen] = useState(false);
	// const [currentCreator, setCurrentCreator] = useState<creatorUser | null>(null);
	const { useCallStartsAt } = useCallStateHooks();

	const [timeLeft, setTimeLeft] = useState(NaN);
	const [lowBalanceNotified, setLowBalanceNotified] = useState(false);
	const [hasLowBalance, setHasLowBalance] = useState(false);
	const [isTimerRunning, setIsTimerRunning] = useState(true);
	const [totalTimeUtilized, setTotalTimeUtilized] = useState(0);
	const { walletBalance } = useWalletBalanceContext();
	const lowBalanceThreshold = 300;

	const callStartedAt = useCallStartsAt();

	const pauseTimer = () => setIsTimerRunning(false);
	const resumeTimer = () => setIsTimerRunning(true);

	useEffect(() => {
		const storedCreator = localStorage.getItem("currentCreator");
		if (storedCreator) {
			const parsedCreator: creatorUser = JSON.parse(storedCreator);
			// setCurrentCreator(parsedCreator);
			if (parsedCreator.audioRate) {
				setAudioRatePerMinute(parseInt(parsedCreator.audioRate, 10));
			}
			if (parsedCreator.videoRate) {
				setVideoRatePerMinute(parseInt(parsedCreator.videoRate, 10));
			}
		}
	}, []);

	useEffect(() => {
		const ratePerMinute = isVideoCall ? videoRatePerMinute : audioRatePerMinute;
		let maxCallDuration = (walletBalance / ratePerMinute) * 60; // in seconds
		maxCallDuration = maxCallDuration > 3600 ? 3600 : maxCallDuration; // Limit to 60 minutes (3600 seconds)
		if (!callStartedAt) {
			// If call hasn't started yet, set timeLeft to maxCallDuration
			setTimeLeft(maxCallDuration);
			return;
		}

		const callStartedTime = new Date(callStartedAt);

		const intervalId = setInterval(() => {
			if (isTimerRunning) {
				const now = new Date();
				const timeUtilized = (now.getTime() - callStartedTime.getTime()) / 1000; // Time in seconds

				const newTimeLeft = maxCallDuration - timeUtilized;

				setTimeLeft(newTimeLeft > 0 ? newTimeLeft : 0);
				setTotalTimeUtilized(timeUtilized);

				if (newTimeLeft <= 0) {
					clearInterval(intervalId);
					// endCall();
				}

				if (
					isMeetingOwner &&
					newTimeLeft <= lowBalanceThreshold &&
					newTimeLeft > 0
				) {
					setHasLowBalance(true);
					if (!lowBalanceNotified) {
						setLowBalanceNotified(true);
						toast({
							title: "Call Will End Soon",
							description: "Client's wallet balance is low.",
						});
					}
				} else if (newTimeLeft > lowBalanceThreshold) {
					setHasLowBalance(false);
					setLowBalanceNotified(false);
				}
			}
		}, 1000);

		return () => clearInterval(intervalId);
	}, [
		isTimerRunning,
		isMeetingOwner,
		audioRatePerMinute,
		videoRatePerMinute,
		lowBalanceNotified,
		lowBalanceThreshold,
		toast,
		callStartedAt,
		walletBalance,
	]);

	return (
		<CallTimerContext.Provider
			value={{
				timeLeft: formatTimeLeft(timeLeft),
				hasLowBalance,
				pauseTimer,
				resumeTimer,
				anyModalOpen,
				setAnyModalOpen,
				totalTimeUtilized,
			}}
		>
			{children}
		</CallTimerContext.Provider>
	);
};
