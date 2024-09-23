import { useEffect, useState, useMemo } from "react";
import {
	CallParticipantsList,
	CallingState,
	DeviceSettings,
	PaginatedGridLayout,
	SpeakerLayout,
	SpeakingWhileMutedNotification,
	ToggleAudioPublishingButton,
	ToggleVideoPublishingButton,
	useCall,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Users } from "lucide-react";
import EndCallButton from "../calls/EndCallButton";
import CallTimer from "../calls/CallTimer";
import { useCallTimerContext } from "@/lib/context/CallTimerContext";
import { useToast } from "../ui/use-toast";
import useWarnOnUnload from "@/hooks/useWarnOnUnload";
import { VideoToggleButton } from "../calls/VideoToggleButton";
import { AudioToggleButton } from "../calls/AudioToggleButton";
import SinglePostLoader from "../shared/SinglePostLoader";
import SwitchCameraType from "../calls/SwitchCameraType";
import AudioDeviceList from "../calls/AudioDeviceList";
import CustomParticipantViewUI from "../calls/CustomParticipantViewUI";
import { logEvent } from "firebase/analytics";
import { analytics } from "@/lib/firebase";
import CreatorCallTimer from "../creator/CreatorCallTimer";
import { useCurrentUsersContext } from "@/lib/context/CurrentUsersContext";
import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";

type CallLayoutType = "grid" | "speaker-bottom";

// Custom hook to track screen size
const useScreenSize = () => {
	const [isMobile, setIsMobile] = useState(false);

	const handleResize = () => {
		setIsMobile(window.innerWidth < 768);
	};

	useEffect(() => {
		handleResize(); // Set initial value
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return isMobile;
};

const MeetingRoom = () => {
	const [showParticipants, setShowParticipants] = useState(false);
	const [showControls, setShowControls] = useState(true);
	const { useCallCallingState, useCallEndedAt, useParticipantCount } =
		useCallStateHooks();
	const [hasJoined, setHasJoined] = useState(false);
	const [showAudioDeviceList, setShowAudioDeviceList] = useState(false);
	const { currentUser } = useCurrentUsersContext();
	const call = useCall();
	const callEndedAt = useCallEndedAt();
	const callHasEnded = !!callEndedAt;
	const { toast } = useToast();
	const isVideoCall = useMemo(() => call?.type === "default", [call]);

	const callingState = useCallCallingState();
	const participantCount = useParticipantCount();

	const { anyModalOpen } = useCallTimerContext();
	const [layout, setLayout] = useState<CallLayoutType>("grid");

	const router = useRouter();

	useWarnOnUnload("Are you sure you want to leave the meeting?", () =>
		call?.endCall()
	);

	const isMobile = useScreenSize();

	const handleCallRejected = async () => {
		await call?.endCall();
	};

	useEffect(() => {
		if (isMobile) {
			setLayout("speaker-bottom");
		} else {
			setLayout("grid");
		}
	}, [isMobile]);

	useEffect(() => {
		const joinCall = async () => {
			if (
				!hasJoined &&
				callingState !== CallingState.JOINED &&
				!callHasEnded &&
				participantCount < 2
			) {
				try {
					await call?.join();
					setHasJoined(true);
					logEvent(analytics, "call_connected", {
						userId: currentUser?._id,
					});
				} catch (error: any) {
					console.warn("Error Joining Call ", error);
				}
			} else {
				setHasJoined(true);
				toast({
					variant: "destructive",
					title: "Participants Limit Reached",
					description: "At most 2 Participants are allowed",
				});

				// Stop camera and microphone
				const stopMediaStreams = () => {
					navigator.mediaDevices
						.getUserMedia({ video: true, audio: true })
						.then((mediaStream) => {
							mediaStream.getTracks().forEach((track) => {
								track.stop();
							});
						})
						.catch((error) => {
							console.error("Error stopping media streams: ", error);
						});
				};

				stopMediaStreams();
				setTimeout(() => {
					router.replace("/home");
				}, 1000);
			}
		};

		if (!hasJoined && call) {
			isVideoCall && call.camera.enable();
			call.microphone.enable();

			joinCall();
		}
	}, [call, hasJoined, callHasEnded]);

	useEffect(() => {
		const handleResize = () => {
			const height = window.innerHeight;
			document.documentElement.style.setProperty("--vh", `${height * 0.01}px`);
		};

		window.addEventListener("resize", handleResize);
		handleResize();

		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	// Hide/Show controls on mobile touch outside controls section
	useEffect(() => {
		if (!isMobile) return;

		const handleTouchOutsideControls = (event: TouchEvent) => {
			const controlsElement = document.querySelector(".call-controls");
			if (controlsElement && !controlsElement.contains(event.target as Node)) {
				setShowControls(false);
			} else {
				setShowControls(true);
			}
		};

		document.addEventListener("touchstart", handleTouchOutsideControls);
		return () => {
			document.removeEventListener("touchstart", handleTouchOutsideControls);
		};
	}, [isMobile]);

	useEffect(() => {
		let timeoutId: NodeJS.Timeout;

		if (participantCount === 2) {
			call?.on("call.session_participant_left", handleCallRejected);
		}

		if (participantCount < 2 || anyModalOpen) {
			timeoutId = setTimeout(async () => {
				toast({
					variant: "destructive",
					title: "Call Ended ...",
					description: "Less than 2 Participants or Due to Inactivity",
				});
				await call?.endCall();
			}, 60000); // 1 minute
		}

		return () => clearTimeout(timeoutId);
	}, [participantCount, anyModalOpen, call]);

	const toggleCamera = async () => {
		if (call && call.camera) {
			try {
				await call.camera.flip();
			} catch (error) {
				Sentry.captureException(error);
				console.error("Error toggling camera:", error);
			}
		}
	};

	const CallLayout = useMemo(() => {
		switch (layout) {
			case "grid":
				return <PaginatedGridLayout />;
			default:
				return (
					<SpeakerLayout
						participantsBarPosition="bottom"
						ParticipantViewUIBar={<CustomParticipantViewUI />}
						ParticipantViewUISpotlight={<CustomParticipantViewUI />}
					/>
				);
		}
	}, [layout]);

	const isMeetingOwner = currentUser?._id === call?.state?.createdBy?.id;

	if (callingState !== CallingState.JOINED) {
		return (
			<section
				className="w-full flex items-center justify-center"
				style={{ height: "calc(var(--vh, 1vh) * 100)" }}
			>
				<SinglePostLoader />
			</section>
		);
	}

	return (
		<section
			className="relative w-full overflow-hidden pt-4 text-white bg-dark-2"
			style={{ height: "calc(var(--vh, 1vh) * 100)" }}
		>
			<div className="relative flex size-full items-center justify-center transition-all">
				<div className="flex size-full max-w-[95%] md:max-w-[1000px] items-center transition-all">
					{CallLayout}
				</div>

				{showParticipants && (
					<div className="h-fit w-full fixed right-0 top-0 md:top-2 md:right-2 md:max-w-[400px] rounded-xl ml-2 p-4 z-20 bg-black transition-all">
						<CallParticipantsList onClose={() => setShowParticipants(false)} />
					</div>
				)}
			</div>

			{!callHasEnded && isMeetingOwner ? (
				<CallTimer
					handleCallRejected={handleCallRejected}
					isVideoCall={isVideoCall}
				/>
			) : (
				call && <CreatorCallTimer callId={call.id} />
			)}

			{/* Call Controls */}
			{showControls && (
				<section className="fixed bg-dark-1 bottom-0 flex w-full items-center justify-start py-2 px-4 transition-all">
					<div className="flex overflow-x-scroll no-scrollbar w-fit items-center mx-auto justify-start gap-4">
						{/* Audio Button */}
						<SpeakingWhileMutedNotification>
							{isMobile ? (
								<AudioToggleButton />
							) : (
								<ToggleAudioPublishingButton />
							)}
						</SpeakingWhileMutedNotification>

						{/* Audio Device List */}
						{isMobile && (
							<AudioDeviceList
								showAudioDeviceList={showAudioDeviceList}
								setShowAudioDeviceList={setShowAudioDeviceList}
							/>
						)}

						{/* Video Button */}
						{isVideoCall &&
							(isMobile ? (
								<VideoToggleButton />
							) : (
								<ToggleVideoPublishingButton />
							))}

						{/* Switch Camera */}
						{isVideoCall && isMobile && (
							<SwitchCameraType toggleCamera={toggleCamera} />
						)}

						<Tooltip>
							<TooltipTrigger className="hidden md:block">
								<button onClick={() => setShowParticipants((prev) => !prev)}>
									<div className="cursor-pointer rounded-full bg-[#ffffff14] p-3 hover:bg-[#4c535b] flex items-center">
										<Users size={20} className="text-white" />
									</div>
								</button>
							</TooltipTrigger>
							<TooltipContent className="mb-2 bg-gray-700  border-none">
								<p className="!text-white">Participants</p>
							</TooltipContent>
						</Tooltip>

						{/* End Call Button */}
						<Tooltip>
							<TooltipTrigger>
								<EndCallButton />
							</TooltipTrigger>
							<TooltipContent className="hidden md:block mb-2 bg-red-500  border-none">
								<p className="!text-white">End Call</p>
							</TooltipContent>
						</Tooltip>

						{isVideoCall && (
							<div className="absolute bottom-3 right-4 z-20 w-fit hidden md:flex items-center gap-2">
								<DeviceSettings />
							</div>
						)}
					</div>
				</section>
			)}
		</section>
	);
};

export default MeetingRoom;
