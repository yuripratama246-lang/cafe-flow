package com.cafeflow.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.NumberFormat
import java.util.Locale

private val Navy = Color(0xFF122231)
private val Blue = Color(0xFF2563EB)
private val Bg = Color(0xFFF4F7FB)
private val money = NumberFormat.getCurrencyInstance(Locale("id", "ID")).apply { maximumFractionDigits = 0 }

data class Product(val name: String, val price: Int, val stock: Int)
data class CartLine(val product: Product, val qty: Int)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { CafeFlowApp() }
    }
}

@Composable
fun CafeFlowApp() {
    var page by remember { mutableStateOf("Kasir") }
    var loggedIn by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var products by remember { mutableStateOf(listOf(
        Product("Kopi Susu", 18000, 24), Product("Americano", 15000, 18),
        Product("Matcha Latte", 22000, 12), Product("Croissant", 16000, 9),
        Product("Kentang Goreng", 20000, 15), Product("Air Mineral", 6000, 30)
    )) }
    var cart by remember { mutableStateOf(listOf<CartLine>()) }
    var transactions by remember { mutableIntStateOf(0) }
    var revenue by remember { mutableIntStateOf(0) }
    var notice by remember { mutableStateOf("") }

    MaterialTheme(colorScheme = lightColorScheme(primary = Blue, background = Bg, surface = Color.White)) {
        if (!loggedIn) {
            LoginScreen(email, { email = it }, password, { password = it }) {
                loggedIn = true
                notice = "Mode demo lokal aktif — login belum terhubung ke Supabase."
            }
        } else {
            Row(Modifier.fillMaxSize().background(Bg)) {
                Column(
                    Modifier.width(82.dp).fillMaxHeight().background(Navy).padding(vertical = 14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("CF", color = Color.White, fontWeight = FontWeight.Black)
                    Spacer(Modifier.height(24.dp))
                    listOf("Kasir", "Stok", "QR Order", "Laporan", "Printer").forEach { item ->
                        NavigationRailItem(
                            selected = page == item,
                            onClick = { page = item },
                            icon = {
                                Icon(when(item) {
                                    "Kasir" -> Icons.Default.PointOfSale
                                    "Stok" -> Icons.Default.Inventory2
                                    "QR Order" -> Icons.Default.QrCode2
                                    "Laporan" -> Icons.Default.BarChart
                                    else -> Icons.Default.Print
                                }, contentDescription = item, tint = if (page == item) Blue else Color.White)
                            },
                            label = { Text(item, color = Color.White, maxLines = 1) },
                            alwaysShowLabel = true,
                            colors = NavigationRailItemDefaults.colors(indicatorColor = Color.White)
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = { loggedIn = false }) { Icon(Icons.Default.Logout, null, tint = Color.White) }
                }
                Column(Modifier.fillMaxSize().padding(18.dp)) {
                    Text("Cafe Flow", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Navy)
                    Text("Native Android • MVP Demo", color = Color.Gray, style = MaterialTheme.typography.bodySmall)
                    if (notice.isNotBlank()) {
                        Spacer(Modifier.height(8.dp))
                        Text(notice, color = Blue, style = MaterialTheme.typography.bodySmall)
                    }
                    Spacer(Modifier.height(18.dp))
                    when(page) {
                        "Kasir" -> CashierScreen(products, cart,
                            onAdd = { p ->
                                val found = cart.find { it.product.name == p.name }
                                cart = if (found == null) cart + CartLine(p, 1)
                                else cart.map { if (it.product.name == p.name) it.copy(qty = it.qty + 1) else it }
                            },
                            onMinus = { p ->
                                cart = cart.mapNotNull { line ->
                                    if (line.product.name != p.name) line
                                    else if (line.qty <= 1) null else line.copy(qty = line.qty - 1)
                                }
                            },
                            onCheckout = {
                                if (cart.isNotEmpty()) {
                                    val total = cart.sumOf { it.product.price * it.qty }
                                    transactions += 1
                                    revenue += total
                                    cart = emptyList()
                                    notice = "Checkout demo berhasil. Data belum tersimpan ke backend."
                                }
                            })
                        "Stok" -> StockScreen(products)
                        "QR Order" -> PlaceholderScreen("QR Ordering", "Halaman pelanggan QR dan pengiriman order belum terhubung.", Icons.Default.QrCode2)
                        "Laporan" -> ReportScreen(transactions, revenue)
                        else -> PlaceholderScreen("Printer Bluetooth", "Pencarian printer dan cetak ESC/POS belum diimplementasikan. Perlu izin Bluetooth Android dan tes printer fisik.", Icons.Default.Print)
                    }
                }
            }
        }
    }
}

@Composable
fun LoginScreen(email: String, onEmail: (String) -> Unit, password: String, onPassword: (String) -> Unit, onContinue: () -> Unit) {
    Column(Modifier.fillMaxSize().background(Bg).padding(28.dp), verticalArrangement = Arrangement.Center) {
        Text("CAFE FLOW", color = Blue, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.height(10.dp))
        Text("Masuk ke workspace", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = Navy)
        Text("Prototype native Android", color = Color.Gray)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(email, onEmail, Modifier.fillMaxWidth(), label = { Text("Email") }, singleLine = true)
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(password, onPassword, Modifier.fillMaxWidth(), label = { Text("Password") }, singleLine = true)
        Spacer(Modifier.height(18.dp))
        Button(onClick = onContinue, Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(14.dp)) { Text("Masuk demo") }
        Spacer(Modifier.height(8.dp))
        Text("Login ini hanya simulasi; autentikasi Supabase belum disambungkan.", color = Color.Gray, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun CashierScreen(products: List<Product>, cart: List<CartLine>, onAdd: (Product) -> Unit, onMinus: (Product) -> Unit, onCheckout: () -> Unit) {
    val total = cart.sumOf { it.product.price * it.qty }
    Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(Modifier.weight(1.15f)) {
            Text("Menu", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(products) { p ->
                    Card(shape = RoundedCornerShape(14.dp)) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(p.name, fontWeight = FontWeight.SemiBold)
                                Text(money.format(p.price), color = Blue)
                                Text("Stok demo: ${p.stock}", color = Color.Gray, style = MaterialTheme.typography.labelSmall)
                            }
                            IconButton(onClick = { onAdd(p) }) { Icon(Icons.Default.AddCircle, "Tambah", tint = Blue) }
                        }
                    }
                }
            }
        }
        Column(Modifier.weight(0.95f).fillMaxHeight()) {
            Text("Pesanan", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Card(Modifier.weight(1f).fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
                if (cart.isEmpty()) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Belum ada item", color = Color.Gray)
                } else LazyColumn(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(cart) { line ->
                        Column {
                            Text(line.product.name, fontWeight = FontWeight.SemiBold)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("${line.qty} × ${money.format(line.product.price)}", Modifier.weight(1f), color = Color.Gray, style = MaterialTheme.typography.bodySmall)
                                IconButton(onClick = { onMinus(line.product) }, modifier = Modifier.size(32.dp)) { Icon(Icons.Default.RemoveCircleOutline, "Kurangi") }
                                IconButton(onClick = { onAdd(line.product) }, modifier = Modifier.size(32.dp)) { Icon(Icons.Default.AddCircleOutline, "Tambah") }
                            }
                            HorizontalDivider()
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Text("Total", color = Color.Gray)
            Text(money.format(total), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Navy)
            Spacer(Modifier.height(8.dp))
            Button(onClick = onCheckout, enabled = cart.isNotEmpty(), Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) {
                Text("Checkout demo")
            }
        }
    }
}

@Composable
fun StockScreen(products: List<Product>) {
    Text("Produk & stok", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(12.dp))
    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(products) { p ->
            Card(shape = RoundedCornerShape(14.dp)) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text(p.name, fontWeight = FontWeight.SemiBold); Text(money.format(p.price), color = Color.Gray) }
                    Text("${p.stock} pcs", color = if (p.stock < 10) Color(0xFFB45309) else Blue, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
    Spacer(Modifier.height(8.dp))
    Text("Daftar stok contoh — edit stok dan sinkronisasi database belum tersedia.", color = Color.Gray, style = MaterialTheme.typography.bodySmall)
}

@Composable
fun ReportScreen(transactions: Int, revenue: Int) {
    Text("Ringkasan laporan", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(14.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        MetricCard("Omzet demo", money.format(revenue), Modifier.weight(1f))
        MetricCard("Transaksi", transactions.toString(), Modifier.weight(1f))
    }
    Spacer(Modifier.height(12.dp))
    Card(shape = RoundedCornerShape(14.dp)) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text("Status data", fontWeight = FontWeight.Bold)
            Text("Angka di atas hanya checkout yang dilakukan selama aplikasi terbuka. Belum membaca transaksi Supabase.", color = Color.Gray)
        }
    }
}

@Composable
fun MetricCard(title: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier, shape = RoundedCornerShape(14.dp)) {
        Column(Modifier.padding(14.dp)) {
            Text(title, color = Color.Gray, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(6.dp))
            Text(value, color = Navy, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
        }
    }
}

@Composable
fun PlaceholderScreen(title: String, description: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(icon, null, tint = Blue, modifier = Modifier.size(54.dp))
        Spacer(Modifier.height(12.dp))
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(description, color = Color.Gray)
        Spacer(Modifier.height(10.dp))
        Text("Status: belum terhubung", color = Blue, style = MaterialTheme.typography.labelMedium)
    }
}
