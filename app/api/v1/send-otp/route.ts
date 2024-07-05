// sendOTP.ts
import { NextRequest, NextResponse } from "next/server";
import { Twilio } from "twilio";
import { generateToken } from "@/lib/token";

const client = new Twilio(
	process.env.TWILIO_ACCOUNT_SID!,
	process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(req: NextRequest) {
	try {
		const { phone } = await req.json();
		const countryCode = 91;
		const fullPhoneNumber = `+${countryCode}${phone}`;
		if (!phone) {
			return NextResponse.json(
				{ error: "Phone number is required" },
				{ status: 400 }
			);
		}

		const otp = Math.floor(100000 + Math.random() * 900000).toString();

		await client.messages.create({
			body: `${otp} is your one time password(OTP) to log in to FLASHCALL. Please enter the OTP to proceed.`,
			from: process.env.TWILIO_PHONE_NUMBER!,
			to: fullPhoneNumber,
		});

		const token = generateToken(fullPhoneNumber, otp);

		return NextResponse.json({ message: "OTP sent successfully", token });
	} catch (error) {
		return NextResponse.json({ error }, { status: 500 });
	}
}
