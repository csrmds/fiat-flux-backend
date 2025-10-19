import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req) => {
	// Handle CORS preflight requests
	if (req.method === 'OPTIONS') {
		return new Response(null, {
			headers: corsHeaders
		});
	}
	try {
		console.log('Market data function called');
		// Get API key from environment
		const twelveDataApiKey = Deno.env.get('TWELVE_DATA_API_KEY');
		if (!twelveDataApiKey) {
			console.error('TWELVE_DATA_API_KEY not found in environment');
			return new Response(JSON.stringify({

				error: 'API key not configured'
			}), {
				status: 500,
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json'
				}
			});
		}
		// Initialize Supabase client
		const supabaseUrl = Deno.env.get('SUPABASE_URL');
		const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
		const supabase = createClient(supabaseUrl, supabaseKey);
		// Parse request parameters
		const url = new URL(req.url);
		const symbol = url.searchParams.get('symbol') || 'BTC/USD';
		const interval = url.searchParams.get('interval') || '1day';
		const start_date = url.searchParams.get('start_date');
		const end_date = url.searchParams.get('end_date');
		console.log(`Fetching data for ${symbol} with interval ${interval}`);
		// Build Twelve Data API URL
		const twelveDataUrl = new URL('https://api.twelvedata.com/time_series');
		twelveDataUrl.searchParams.append('symbol', symbol);
		twelveDataUrl.searchParams.append('interval', interval);
		twelveDataUrl.searchParams.append('apikey', twelveDataApiKey);
		twelveDataUrl.searchParams.append('format', 'json');
		if (start_date) {
			twelveDataUrl.searchParams.append('start_date', start_date);
		}
		if (end_date) {
			twelveDataUrl.searchParams.append('end_date', end_date);
		}
		// Fetch data from Twelve Data API
		console.log(`Calling Twelve Data API: ${twelveDataUrl.toString()}`);
		const response = await fetch(twelveDataUrl.toString());
		if (!response.ok) {
			console.error(`Twelve Data API error: ${response.status} ${response.statusText}`);
			return new Response(JSON.stringify({
				error: `External API error: ${response.status}`
			}), {
				status: response.status,
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json'
				}
			});
		}
		const data = await response.json();
		console.log(`Received data from Twelve Data API:`, data);
		// Check if API returned an error
		if (data.status === 'error') {
			console.error('Twelve Data API returned error:', data);
			return new Response(JSON.stringify({
				error: 'External API returned error',
				details: data
			}), {
				status: 400,
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json'
				}
			});
		}
		// Transform data for frontend
		const transformedData = {
			symbol: data.meta?.symbol || symbol,
			interval: data.meta?.interval || interval,
			from: start_date,
			to: end_date,
			points: data.values?.map((item) => ({
				ts: item.datetime,
				open: parseFloat(item.open),
				high: parseFloat(item.high),
				low: parseFloat(item.low),
				close: parseFloat(item.close),
				volume: item.volume ? parseFloat(item.volume) : undefined
			})) || []
		};
		// Save to Supabase database
		try {
			const { error: dbError } = await supabase.from('market_data').insert({
				symbol,
				provider: 'twelve_data',
				data: data
			});
			if (dbError) {
				console.error('Error saving to database:', dbError);
				// Continue execution - don't fail the request if database save fails
			} else {
				console.log('Data saved to database successfully');
			}
		} catch (dbErr) {
			console.error('Database save error:', dbErr);
			// Continue execution
		}
		// Return transformed data to frontend
		return new Response(JSON.stringify(transformedData), {
			headers: {
				...corsHeaders,
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Error in market-data function:', error);
		return new Response(JSON.stringify({
			error: error instanceof Error ? error.message : 'Unknown error'
		}), {
			status: 500,
			headers: {
				...corsHeaders,
				'Content-Type': 'application/json'
			}
		});
	}
});
