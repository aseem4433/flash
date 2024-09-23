import { connectToDatabase } from "@/lib/database";
import { WalletParams } from "@/types";
import Client from "../database/models/client.model";
import Creator from "../database/models/creator.model";
import Transaction from "../database/models/transaction.model";
import Wallet from "../database/models/wallet.models";
import { handleError } from "../utils";
import * as Sentry from "@sentry/nextjs";

export async function addMoney({ userId, userType, amount }: WalletParams) {
	try {
		await connectToDatabase();

		let user;
		if (userType === "Client") {
			user = await Client.findById(userId);
		} else if (userType === "Creator") {
			user = await Creator.findById(userId);
		} else {
			throw new Error("Invalid user type");
		}

		if (!user) throw new Error("User not found");

		// Ensure amount is a number
		const numericAmount = Math.round(Number(amount) * 100) / 100;
		if (isNaN(numericAmount)) {
			throw new Error("Amount must be a number");
		}

		// Increment the user's wallet balance
		user.walletBalance = Number(user.walletBalance) + numericAmount;
		await user.save();

		// Update the Wallet collection
		const wallet = await Wallet.findOneAndUpdate(
			{ userId, userType },
			{ $inc: { balance: numericAmount } },
			{ new: true, upsert: true }
		);

		// Create a transaction record
		numericAmount > 0 &&
			(await Transaction.create({
				userId,
				userType,
				amount: numericAmount,
				type: "credit",
			}));

		if (user.referredBy && user.referralAmount > 0) {
			const referrer = await Creator.findOne({ _id: user.referredBy });
			if (referrer) {
				const referralBonus = (5 / 100) * numericAmount;
				referrer.walletBalance = Number(referrer.walletBalance) + referralBonus;
				await referrer.save();
				await Wallet.findOneAndUpdate(
					{ userId: referrer._id, userType: "Creator" },
					{ $inc: { balance: referralBonus } },
					{ new: true, upsert: true }
				);
				user.referralAmount = Number(user.referralAmount) - referralBonus;
				await user.save();

				referralBonus > 0 &&
					(await Transaction.create({
						userId: referrer._id,
						userType,
						amount: referralBonus,
						type: "credit",
					}));
			}
		}

		return JSON.parse(JSON.stringify(wallet));
	} catch (error) {
		Sentry.captureException(error);
		console.error("Error in addMoney:", error);
		throw new Error("Error adding money");
	}
}

export async function processPayout({
	userId,
	userType,
	amount,
}: WalletParams) {
	try {
		await connectToDatabase();

		let user;
		if (userType === "Client") {
			user = await Client.findById(userId);
		} else if (userType === "Creator") {
			user = await Creator.findById(userId);
		} else {
			throw new Error("Invalid user type");
		}

		if (!user) throw new Error("User not found");
		if (user.walletBalance < amount) throw new Error("Insufficient balance");

		// Ensure amount is a number
		const numericAmount = Math.round(Number(amount) * 100) / 100;
		if (isNaN(numericAmount)) {
			throw new Error("Amount must be a number");
		}

		// Decrement the user's wallet balance
		user.walletBalance = Number(user.walletBalance) - numericAmount;
		await user.save();

		// console.log("Wallet Balance: " + user.walletBalance);

		// Update the Wallet collection
		const wallet = await Wallet.findOneAndUpdate(
			{ userId, userType },
			{ $inc: { balance: -numericAmount } },
			{ new: true, upsert: true }
		);

		// Create a transaction record
		await Transaction.create({
			userId,
			userType,
			amount: numericAmount,
			type: "debit",
		});

		// Implement Razorpay payout logic here

		return JSON.parse(JSON.stringify(wallet));
	} catch (error) {
		Sentry.captureException(error);
		console.error("Error in processPayout:", error);
		throw new Error("Error processing payout");
	}
}

export async function getTransactionsByUserId(
	userId: string
	// page = 1,
	// limit = 10
) {
	try {
		await connectToDatabase();
		// const skip = (page - 1) * limit;

		const transactions = await Transaction.find({ userId })
			.sort({ createdAt: -1 })
			// .skip(skip)
			// .limit(limit)
			.lean();

		// const totalTransactions = await Transaction.countDocuments({ userId });

		// return { transactions, totalTransactions };
		return { transactions };
	} catch (error) {
		Sentry.captureException(error);
		console.error(error);
		handleError(error);
	}
}

export async function getCreatorTransactionsByUserId(
	userId: string,
	page = 1
	// limit = 10
) {
	try {
		await connectToDatabase();
		// const skip = (page - 1) * limit;

		const transactions = await Transaction.find({ userId })
			.sort({ createdAt: -1 })
			// .skip(skip)
			// .limit(limit)
			.lean();

		const totalTransactions = await Transaction.countDocuments({ userId });

		return { transactions, totalTransactions };
	} catch (error) {
		Sentry.captureException(error);
		console.error(error);
		handleError(error);
	}
}

export async function getTransactionsByType(type: "debit" | "credit") {
	try {
		await connectToDatabase();
		const transactions = await Transaction.find({ type })
			.sort({ createdAt: -1 })
			.lean();
		return transactions;
	} catch (error) {
		Sentry.captureException(error);
		console.error(error);
		handleError(error);
	}
}

export async function getTransactionsByUserIdAndType(
	userId: string,
	type: "debit" | "credit"
	// page = 1,
	// limit = 10
) {
	try {
		await connectToDatabase();
		// const skip = (page - 1) * limit;

		const transactions = await Transaction.find({ userId, type })
			.sort({ createdAt: -1 })
			// .skip(skip)
			// .limit(limit)
			.lean();

		// const totalTransactions = await Transaction.countDocuments({
		// 	userId,
		// 	type,
		// });

		return { transactions };
	} catch (error) {
		Sentry.captureException(error);
		console.error(error);
		handleError(error);
	}
}
export async function getCreatorTransactionsByUserIdAndType(
	userId: string,
	type: "debit" | "credit",
	page = 1
	// limit = 10
) {
	try {
		await connectToDatabase();
		// const skip = (page - 1) * limit;

		const transactions = await Transaction.find({ userId, type })
			.sort({ createdAt: -1 })
			// .skip(skip)
			// .limit(limit)
			.lean();

		const totalTransactions = await Transaction.countDocuments({
			userId,
			type,
		});

		return { transactions, totalTransactions };
	} catch (error) {
		Sentry.captureException(error);
		console.error(error);
		handleError(error);
	}
}

export async function getAllTransactionsByUserId(userId: string) {
	try {
		await connectToDatabase();
		const transactions = await Transaction.find({ userId })
			.sort({ createdAt: -1 })
			.lean();
		return { transactions };
	} catch (error) {
		Sentry.captureException(error);
		console.error(error);
		handleError(error);
	}
}

export async function getUsersTransactionsByType(
	userId: string,
	type: "debit" | "credit"
) {
	try {
		await connectToDatabase();

		const transactions = await Transaction.find({ userId, type })
			.sort({ createdAt: -1 })
			.lean();

		return { transactions };
	} catch (error) {
		Sentry.captureException(error);
		console.error(error);
		handleError(error);
	}
}

export async function getTransactionsByUserIdAndDate(
	userId: string,
	date: string
) {
	try {
		await connectToDatabase();

		// Convert the provided date string to a Date object
		const targetDate = new Date(date);
		const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
		const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

		const transactions = await Transaction.find({
			userId,
			createdAt: {
				$gte: startOfDay,
				$lte: endOfDay,
			},
		})
			.sort({ createdAt: -1 })
			.lean();

		return { transactions };
	} catch (error) {
		Sentry.captureException(error);
		console.error(error);
		handleError(error);
	}
}
