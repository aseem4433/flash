import { getFavorites } from "@/lib/actions/favorites.actions";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: Request) {
	try {
		const { clientId } = await request.json();
		const favorites = await getFavorites(clientId);
		return NextResponse.json(favorites);
	} catch (error) {
		Sentry.captureException(error);
		console.error(error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
