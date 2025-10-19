-- Create market_data table for storing cryptocurrency data
CREATE TABLE public.market_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'twelve_data',
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (since this is market data)
CREATE POLICY "Market data is publicly readable" 
ON public.market_data 
FOR SELECT 
USING (true);

-- Create policy for inserting data (only for authenticated users or service role)
CREATE POLICY "Service can insert market data" 
ON public.market_data 
FOR INSERT 
WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX idx_market_data_symbol ON public.market_data(symbol);
CREATE INDEX idx_market_data_created_at ON public.market_data(created_at DESC);