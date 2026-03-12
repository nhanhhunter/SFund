import argparse
import json
import os
from pathlib import Path


def configure_environment() -> None:
    runtime_root = os.environ.get("VNSTOCK_RUNTIME_DIR", "")
    if runtime_root:
        runtime_path = Path(runtime_root)
        runtime_path.mkdir(parents=True, exist_ok=True)
        os.environ["USERPROFILE"] = str(runtime_path)
        os.environ["HOME"] = str(runtime_path)

        matplotlib_dir = runtime_path / "matplotlib"
        matplotlib_dir.mkdir(parents=True, exist_ok=True)
        os.environ["MPLCONFIGDIR"] = str(matplotlib_dir)

    os.environ["ACCEPT_TC"] = "tôi đồng ý"

    for key in ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]:
        os.environ.pop(key, None)
    os.environ["NO_PROXY"] = "*"
    os.environ["no_proxy"] = "*"

    api_key = os.environ.get("VNSTOCK_API_KEY", "").strip()
    if api_key:
        try:
            from vnai import setup_api_key

            setup_api_key(api_key)
        except Exception:
            pass


def dataframe_to_records(df):
    if df is None:
        return []

    if hasattr(df, "empty") and df.empty:
        return []

    records = df.to_dict(orient="records")
    normalized = []

    for record in records:
        normalized_record = {}
        for key, value in record.items():
            if hasattr(value, "isoformat"):
                normalized_record[key] = value.isoformat()
            elif key == "time" and value is not None:
                normalized_record[key] = str(value)
            else:
                normalized_record[key] = value
        normalized.append(normalized_record)

    return normalized


def run_price_board(symbols, source):
    from vnstock import Trading

    trading = Trading(source=source.lower(), show_log=False)
    dataframe = trading.price_board(symbols_list=symbols, get_all=False)
    return dataframe_to_records(dataframe)


def run_history(symbol, source, start, end, interval):
    from vnstock import Quote

    quote = Quote(source=source.lower(), symbol=symbol.upper(), show_log=False)
    dataframe = quote.history(symbol=symbol.upper(), start=start, end=end, interval=interval)
    return dataframe_to_records(dataframe)


def run_listing(source):
    from vnstock import Listing

    listing = Listing(source=source.lower(), show_log=False)
    dataframe = listing.symbols_by_exchange()
    return dataframe_to_records(dataframe)


def main():
    configure_environment()

    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    price_board_parser = subparsers.add_parser("price-board")
    price_board_parser.add_argument("--symbols", required=True)
    price_board_parser.add_argument("--source", default="KBS")

    history_parser = subparsers.add_parser("history")
    history_parser.add_argument("--symbol", required=True)
    history_parser.add_argument("--source", default="KBS")
    history_parser.add_argument("--start", required=True)
    history_parser.add_argument("--end", required=True)
    history_parser.add_argument("--interval", required=True)

    listing_parser = subparsers.add_parser("listing")
    listing_parser.add_argument("--source", default="KBS")

    args = parser.parse_args()

    if args.command == "price-board":
        data = run_price_board(
            [symbol.strip().upper() for symbol in args.symbols.split(",") if symbol.strip()],
            args.source,
        )
    elif args.command == "history":
        data = run_history(
            args.symbol.upper(),
            args.source,
            args.start,
            args.end,
            args.interval,
        )
    else:
        data = run_listing(args.source)

    print(json.dumps(data, ensure_ascii=False))


if __name__ == "__main__":
    main()
